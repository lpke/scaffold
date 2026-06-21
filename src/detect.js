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

const parseExactVersion = (version) => {
  const match = String(version).match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    return null;
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    version,
  };
};

const compareExactVersions = (left, right) =>
  left.major - right.major || left.minor - right.minor || left.patch - right.patch;

const npmRecentMajorVersions = (packageName, count = 4) => {
  const output = commandOutput('npm', ['view', packageName, 'versions', '--json', '--silent']);
  if (!output) {
    return [];
  }
  let versions;
  try {
    versions = JSON.parse(output);
  } catch {
    return [];
  }
  const exactVersions = (Array.isArray(versions) ? versions : [versions])
    .map(parseExactVersion)
    .filter(Boolean);
  const byMajor = new Map();
  for (const version of exactVersions) {
    const current = byMajor.get(version.major);
    if (!current || compareExactVersions(version, current) > 0) {
      byMajor.set(version.major, version);
    }
  }
  return Array.from(byMajor.values())
    .sort((left, right) => right.major - left.major)
    .slice(0, count)
    .map(({ major, version }) => ({ major, version }));
};

module.exports = {
  detectGit,
  detectNodeMajor,
  detectPackageManager,
  fileExists,
  isDirEmpty,
  listGitRemotes,
  npmLatest,
  npmRecentMajorVersions,
  readJsonFile,
  readText,
  statOrNull,
};
