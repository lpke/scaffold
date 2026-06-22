'use strict';

const fsp = require('node:fs').promises;
const path = require('node:path');

const { assetPath } = require('../../assets');
const { fileExists } = require('../../detect');
const { resolveContent } = require('./content');
const { normalizeActionPath } = require('./paths');

const parseMode = (mode) => {
  if (mode == null) {
    return null;
  }
  if (typeof mode === 'number') {
    return mode;
  }
  if (typeof mode === 'string') {
    return Number.parseInt(mode, 8);
  }
  throw new Error(`Invalid file mode: ${mode}`);
};

const applyFileWrite = async ({ workspace, action, context }) => {
  await workspace.write(normalizeActionPath(action.path), await resolveContent(action, context), {
    overwrite: action.overwrite ?? true,
    mode: parseMode(action.mode),
  });
};

const applyFileDelete = async ({ workspace, action }) => {
  if (Array.isArray(action.paths)) {
    for (const targetPath of action.paths) {
      await workspace.remove(normalizeActionPath(targetPath));
    }
    return;
  }
  await workspace.remove(normalizeActionPath(action.path));
};

const applyFileMove = async ({ workspace, action }) => {
  const fromPath = normalizeActionPath(action.from, { label: 'from' });
  const toPath = normalizeActionPath(action.to, { label: 'to' });
  const fromFile = workspace.targetPath(fromPath);

  if (!(await fileExists(fromFile))) {
    workspace.skipped.push(`${fromPath} absent`);
    workspace.mark(fromPath);
    return;
  }
  if ((await fileExists(workspace.targetPath(toPath))) && !action.overwrite) {
    workspace.skipped.push(`${toPath} exists`);
    workspace.mark(toPath);
    return;
  }

  const targetFile = workspace.targetPath(toPath);
  if (await fileExists(targetFile)) {
    await workspace.backupFile(targetFile);
  }

  workspace.changed.push(`moved ${fromPath} to ${toPath}`);
  workspace.mark(fromPath);
  workspace.mark(toPath);
  if (!workspace.dryRun) {
    await fsp.mkdir(path.dirname(targetFile), { recursive: true });
    await fsp.copyFile(fromFile, targetFile);
    await fsp.rm(fromFile, { force: true });
  }
};

const applyFileCopy = async ({ workspace, action }) => {
  const fromPath = normalizeActionPath(action.from, { label: 'from' });
  const toPath = normalizeActionPath(action.to, { label: 'to' });
  const sourceFile = workspace.targetPath(fromPath);
  const targetFile = workspace.targetPath(toPath);

  if (!(await fileExists(sourceFile))) {
    workspace.skipped.push(`${fromPath} absent`);
    workspace.mark(fromPath);
    return;
  }
  if ((await fileExists(targetFile)) && !action.overwrite) {
    workspace.skipped.push(`${toPath} exists`);
    workspace.mark(toPath);
    return;
  }
  if (await fileExists(targetFile)) {
    await workspace.backupFile(targetFile);
  }

  workspace.changed.push(`${await fileExists(targetFile) ? 'updated' : 'created'} ${toPath}`);
  workspace.mark(toPath);
  if (!workspace.dryRun) {
    await fsp.mkdir(path.dirname(targetFile), { recursive: true });
    await fsp.copyFile(sourceFile, targetFile);
  }
};

const applyFileCopyTemplate = async ({ workspace, action }) => {
  await workspace.copyTemplate(
    normalizeActionPath(action.template, { label: 'template' }),
    normalizeActionPath(action.path),
    { overwrite: action.overwrite ?? workspace.force },
  );
};

const applyFileCopyAsset = async ({ workspace, action }) => {
  const toPath = normalizeActionPath(action.path);
  const targetFile = workspace.targetPath(toPath);
  if ((await fileExists(targetFile)) && !action.overwrite) {
    workspace.skipped.push(`${toPath} exists`);
    workspace.mark(toPath);
    return;
  }
  if (await fileExists(targetFile)) {
    await workspace.backupFile(targetFile);
  }

  workspace.changed.push(`${await fileExists(targetFile) ? 'updated' : 'created'} ${toPath}`);
  workspace.mark(toPath);
  if (!workspace.dryRun) {
    await fsp.mkdir(path.dirname(targetFile), { recursive: true });
    await fsp.copyFile(assetPath(action.asset), targetFile);
  }
};

module.exports = {
  applyFileCopy,
  applyFileCopyAsset,
  applyFileCopyTemplate,
  applyFileDelete,
  applyFileMove,
  applyFileWrite,
};
