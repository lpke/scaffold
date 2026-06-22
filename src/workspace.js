'use strict';

const fsp = require('node:fs').promises;
const path = require('node:path');

const { assetPath, readAsset } = require('./assets');
const { fileExists, readText } = require('./detect');

const sourceTemplatePath = (relativePath) => {
  const installedPath = assetPath(`templates/${relativePath}`);
  return installedPath;
};

const BACKUP_SUFFIX = '.scaffold-backup';
const outputName = (name) => (name.startsWith('dot_') ? `.${name.slice(4)}` : name);
const isBackupArtifactPath = (filePath) =>
  path.normalize(filePath).split(path.sep).some((part) => part.endsWith(BACKUP_SUFFIX));

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
    if (!this.backup || this.dryRun || isBackupArtifactPath(filePath) || !(await fileExists(filePath))) {
      return;
    }
    const backupPath = `${filePath}${BACKUP_SUFFIX}`;
    if (!(await fileExists(backupPath))) {
      const stat = await fsp.stat(filePath);
      if (stat.isDirectory()) {
        await fsp.cp(filePath, backupPath, {
          recursive: true,
          filter: (source) => !isBackupArtifactPath(source),
        });
      } else {
        await fsp.copyFile(filePath, backupPath);
      }
    }
  }

  async write(relativePath, content, { overwrite = true, mode = null } = {}) {
    const filePath = this.targetPath(relativePath);
    const exists = await fileExists(filePath);

    if (exists) {
      const current = await readText(filePath);
      if (current === content) {
        this.skipped.push(`${relativePath} unchanged`);
        this.mark(relativePath);
        if (mode != null && !this.dryRun) {
          await fsp.chmod(filePath, mode);
        }
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
    if (mode != null) {
      await fsp.chmod(filePath, mode);
    }
  }

  async remove(relativePath, { backup = true, protectBackupArtifacts = false } = {}) {
    if (protectBackupArtifacts && isBackupArtifactPath(relativePath)) {
      this.skipped.push(`${relativePath} backup artifact kept`);
      this.mark(relativePath);
      return;
    }
    const filePath = this.targetPath(relativePath);
    const exists = await fileExists(filePath);
    if (!exists) {
      this.skipped.push(`${relativePath} absent`);
      this.mark(relativePath);
      return;
    }

    if (backup) {
      await this.backupFile(filePath);
    }
    this.changed.push(`deleted ${relativePath}`);
    this.mark(relativePath);
    if (!this.dryRun) {
      await fsp.rm(filePath, { recursive: true, force: true });
    }
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
  isBackupArtifactPath,
  Workspace,
};
