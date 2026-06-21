'use strict';

const fs = require('node:fs');
const fsp = fs.promises;
const path = require('node:path');

const { commandOutput } = require('./commands');
const { parseJson } = require('./json');

const statOrNull = async (filePath) => {
  try {
    return await fsp.stat(filePath);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
};

const fileExists = async (filePath) => Boolean(await statOrNull(filePath));

const readText = async (filePath) => fsp.readFile(filePath, 'utf8');

const readJsonFile = async (filePath) => parseJson(await readText(filePath), filePath);

const isDirEmpty = async (dirPath) => {
  try {
    const entries = await fsp.readdir(dirPath);
    return entries.length === 0;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return true;
    }
    throw error;
  }
};

const detectPackageManager = async (targetDir, pkg, config) => {
  const packageManager = pkg?.packageManager;
  if (typeof packageManager === 'string') {
    const manager = packageManager.split('@')[0];
    if (config.packageManagers[manager]) {
      return manager;
    }
  }

  for (const [manager, managerConfig] of Object.entries(config.packageManagers)) {
    if (await fileExists(path.join(targetDir, managerConfig.lockfile))) {
      return manager;
    }
  }

  if (pkg?.engines) {
    for (const manager of Object.keys(config.packageManagers)) {
      if (pkg.engines[manager]) {
        return manager;
      }
    }
  }

  return null;
};

const detectNodeMajor = (pkg, config) => {
  const engine = pkg?.engines?.node;
  if (typeof engine !== 'string') {
    return null;
  }
  const majors = Object.keys(config.nodeTargets).sort((left, right) => Number(right) - Number(left));
  const match = engine.match(new RegExp(`(?:>=|\\^|~)?\\s*(${majors.join('|')})(?:\\.|$)`));
  return match?.[1] ?? null;
};

const detectGit = (targetDir) => {
  const root = commandOutput('git', ['-C', targetDir, 'rev-parse', '--show-toplevel']);
  if (!root) {
    return { inside: false, root: null, hasOwnGit: fs.existsSync(path.join(targetDir, '.git')) };
  }
  return {
    inside: true,
    root,
    hasOwnGit: path.resolve(root) === path.resolve(targetDir),
  };
};

const listGitRemotes = (targetDir) => {
  const output = commandOutput('git', ['-C', targetDir, 'remote']);
  return output ? output.split(/\r?\n/).filter(Boolean) : [];
};

const npmLatest = (packageName) => {
  const output = commandOutput('npm', ['view', packageName, 'version', '--silent']);
  return output || null;
};

module.exports = {
  detectGit,
  detectNodeMajor,
  detectPackageManager,
  fileExists,
  isDirEmpty,
  listGitRemotes,
  npmLatest,
  readJsonFile,
  readText,
  statOrNull,
};
