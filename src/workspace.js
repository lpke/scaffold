'use strict';

const fsp = require('node:fs').promises;
const path = require('node:path');

const { assetPath, readAsset } = require('./assets');
const { fileExists, readText } = require('./detect');

const sourceTemplatePath = (relativePath) => {
  const installedPath = assetPath(`templates/${relativePath}`);
  return installedPath;
};

const outputName = (name) => (name.startsWith('dot_') ? `.${name.slice(4)}` : name);

class Workspace {
  constructor({ targetDir, dryRun, backup, force }) {
    this.targetDir = targetDir;
    this.dryRun = dryRun;
    this.backup = backup;
    this.force = force;
    this.changed = [];
    this.skipped = [];
    this.touchedFiles = new Set();
  }

  targetPath(relativePath) {
    return path.join(this.targetDir, relativePath);
  }

  mark(relativePath) {
    this.touchedFiles.add(relativePath);
  }

  async backupFile(filePath) {
    if (!this.backup || this.dryRun || !(await fileExists(filePath))) {
      return;
    }
    const backupPath = `${filePath}.scaffold-backup`;
    if (!(await fileExists(backupPath))) {
      await fsp.copyFile(filePath, backupPath);
    }
  }

  async write(relativePath, content, { overwrite = true } = {}) {
    const filePath = this.targetPath(relativePath);
    const exists = await fileExists(filePath);

    if (exists) {
      const current = await readText(filePath);
      if (current === content) {
        this.skipped.push(`${relativePath} unchanged`);
        this.mark(relativePath);
        return;
      }
      if (!overwrite) {
        this.skipped.push(`${relativePath} exists`);
        this.mark(relativePath);
        return;
      }
      await this.backupFile(filePath);
    }

    this.changed.push(`${exists ? 'updated' : 'created'} ${relativePath}`);
    this.mark(relativePath);
    if (this.dryRun) {
      return;
    }

    await fsp.mkdir(path.dirname(filePath), { recursive: true });
    await fsp.writeFile(filePath, content);
  }

  async mergeLines(relativePath, lines, { existingHeader = null } = {}) {
    const filePath = this.targetPath(relativePath);
    const exists = await fileExists(filePath);
    const current = exists ? await readText(filePath) : '';
    const existingLines = new Set(
      current
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean),
    );
    const missing = lines.filter((line) => !existingLines.has(line.trim()));

    if (missing.length === 0) {
      this.skipped.push(`${relativePath} already has defaults`);
      this.mark(relativePath);
      return;
    }

    if (exists) {
      await this.backupFile(filePath);
    }

    const prefix = current && !current.endsWith('\n') ? '\n' : '';
    const header =
      exists && existingHeader && !existingLines.has(existingHeader.trim())
        ? `\n${existingHeader}\n`
        : '';
    const content = exists
      ? `${current}${prefix}${header}${missing.join('\n')}\n`
      : `${missing.join('\n')}\n`;

    this.changed.push(
      `${exists ? 'merged' : 'created'} ${relativePath} (${missing.length} lines)`,
    );
    this.mark(relativePath);
    if (!this.dryRun) {
      await fsp.mkdir(path.dirname(filePath), { recursive: true });
      await fsp.writeFile(filePath, content);
    }
  }

  async copyTemplate(relativePath, outputPath = relativePath, options = {}) {
    const content = await readAsset(`templates/${relativePath}`);
    await this.write(outputPath, content, {
      overwrite: options.overwrite ?? this.force,
    });
  }

  async copyTemplateDir(relativePath, outputBase = '.') {
    const root = sourceTemplatePath(relativePath);
    let entries;
    try {
      entries = await fsp.readdir(root, { withFileTypes: true });
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Missing scaffold template directory: ${root}`);
      }
      throw error;
    }

    for (const entry of entries) {
      const sourceRel = path.posix.join(relativePath, entry.name);
      const targetRel = path.posix.join(outputBase, outputName(entry.name));
      if (entry.isDirectory()) {
        await this.copyTemplateDir(sourceRel, targetRel);
      } else if (entry.isFile()) {
        await this.copyTemplate(sourceRel, targetRel);
      }
    }
  }
}

module.exports = {
  Workspace,
};
