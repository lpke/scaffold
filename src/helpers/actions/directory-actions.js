'use strict';

const fsp = require('node:fs').promises;
const path = require('node:path');

const { assetPath } = require('../../assets');
const { fileExists } = require('../../detect');
const { isBackupArtifactPath } = require('../../workspace');
const { matchesAnyPathRule } = require('./matchers');
const { joinActionPath, normalizeActionPath } = require('./paths');

const markDirectory = (workspace, relativePath, message, kind = 'changed') => {
  workspace[kind].push(message);
  workspace.mark(relativePath);
};

const applyDirEnsure = async ({ workspace, action }) => {
  const targetPath = normalizeActionPath(action.path, { allowRoot: true });
  const filePath = workspace.targetPath(targetPath);
  if (await fileExists(filePath)) {
    workspace.skipped.push(`${targetPath} exists`);
    workspace.mark(targetPath);
    return;
  }
  markDirectory(workspace, targetPath, `created ${targetPath}/`);
  if (!workspace.dryRun) {
    await fsp.mkdir(filePath, { recursive: true });
  }
};

const copyDirectory = async ({ workspace, sourceRoot, sourceRel, targetBase, overwrite }) => {
  const entries = await fsp.readdir(path.join(sourceRoot, sourceRel), { withFileTypes: true });
  for (const entry of entries) {
    const nextSourceRel = path.posix.join(sourceRel, entry.name);
    const nextTargetRel = joinActionPath(targetBase, nextSourceRel);
    if (entry.isDirectory()) {
      await copyDirectory({ workspace, sourceRoot, sourceRel: nextSourceRel, targetBase, overwrite });
    } else if (entry.isFile()) {
      const targetFile = workspace.targetPath(nextTargetRel);
      if ((await fileExists(targetFile)) && !overwrite) {
        workspace.skipped.push(`${nextTargetRel} exists`);
        workspace.mark(nextTargetRel);
        continue;
      }
      if (await fileExists(targetFile)) {
        await workspace.backupFile(targetFile);
      }
      workspace.changed.push(`${await fileExists(targetFile) ? 'updated' : 'created'} ${nextTargetRel}`);
      workspace.mark(nextTargetRel);
      if (!workspace.dryRun) {
        await fsp.mkdir(path.dirname(targetFile), { recursive: true });
        await fsp.copyFile(path.join(sourceRoot, nextSourceRel), targetFile);
      }
    }
  }
};

const applyDirCopyTemplate = async ({ workspace, action }) => {
  const templatePath = normalizeActionPath(action.template, { label: 'template' });
  const targetPath = normalizeActionPath(action.path, { allowRoot: true });
  await workspace.copyTemplateDir(templatePath, targetPath);
};

const applyDirCopyAsset = async ({ workspace, action }) => {
  const assetRoot = assetPath(normalizeActionPath(action.asset, { label: 'asset' }));
  const targetPath = normalizeActionPath(action.path, { allowRoot: true });
  await copyDirectory({
    workspace,
    sourceRoot: assetRoot,
    sourceRel: '',
    targetBase: targetPath,
    overwrite: action.overwrite ?? workspace.force,
  });
};

const readEntries = async (absolutePath) => {
  try {
    return await fsp.readdir(absolutePath, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
};

const rulePath = (rule) => {
  if (typeof rule === 'string') return rule;
  return rule?.path ?? rule?.exact ?? rule?.prefix ?? null;
};

const mightKeepDescendant = (innerPath, keepRules) =>
  keepRules.some((rule) => {
    if (rule?.regex || rule?.glob) return true;
    const keepPath = rulePath(rule);
    return keepPath && normalizeActionPath(keepPath, { allowRoot: true }).startsWith(`${innerPath}/`);
  });

const cleanDirectory = async ({
  workspace,
  rootPath,
  innerPath,
  keepRules,
  deleteRules,
  suppressChildBackups,
}) => {
  const absolutePath = workspace.targetPath(joinActionPath(rootPath, innerPath));
  const entries = await readEntries(absolutePath);
  if (entries == null) {
    return false;
  }

  for (const entry of entries) {
    const childInnerPath = innerPath ? path.posix.join(innerPath, entry.name) : entry.name;
    const childTargetPath = joinActionPath(rootPath, childInnerPath);
    if (isBackupArtifactPath(childTargetPath)) {
      workspace.skipped.push(`${childTargetPath} backup artifact kept`);
      workspace.mark(childTargetPath);
      continue;
    }
    const kept = matchesAnyPathRule(childInnerPath, keepRules);
    const selected = deleteRules.length === 0 || matchesAnyPathRule(childInnerPath, deleteRules);

    if (kept) {
      workspace.skipped.push(`${childTargetPath} kept`);
      workspace.mark(childTargetPath);
      continue;
    }

    if (entry.isDirectory() && (keepRules.length > 0 || deleteRules.length > 0)) {
      if (selected && !mightKeepDescendant(childInnerPath, keepRules)) {
        await workspace.remove(childTargetPath, { backup: !suppressChildBackups, protectBackupArtifacts: true });
        continue;
      }
      await cleanDirectory({
        workspace,
        rootPath,
        innerPath: childInnerPath,
        keepRules,
        deleteRules,
        suppressChildBackups,
      });
      const remaining = await readEntries(workspace.targetPath(childTargetPath));
      if (!selected || (remaining && remaining.length > 0)) {
        continue;
      }
    }

    if (!selected) {
      workspace.skipped.push(`${childTargetPath} kept`);
      workspace.mark(childTargetPath);
      continue;
    }

    await workspace.remove(childTargetPath, {
      backup: !suppressChildBackups,
      protectBackupArtifacts: true,
    });
  }
  return true;
};

const applyDirClean = async ({ workspace, action }) => {
  const targetPath = normalizeActionPath(action.path, { allowRoot: true });
  const exists = await fileExists(workspace.targetPath(targetPath));
  if (!exists) {
    if (action.create) {
      await applyDirEnsure({ workspace, action });
    } else {
      workspace.skipped.push(`${targetPath} absent`);
      workspace.mark(targetPath);
    }
    return;
  }
  const fullDirectoryClean = (action.keep ?? []).length === 0 && (action.delete ?? []).length === 0;
  if (fullDirectoryClean) {
    await workspace.backupFile(workspace.targetPath(targetPath));
  }
  await cleanDirectory({
    workspace,
    rootPath: targetPath,
    innerPath: '',
    keepRules: action.keep ?? [],
    deleteRules: action.delete ?? [],
    suppressChildBackups: fullDirectoryClean,
  });
};

module.exports = {
  applyDirClean,
  applyDirCopyAsset,
  applyDirCopyTemplate,
  applyDirEnsure,
};
