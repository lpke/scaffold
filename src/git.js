'use strict';

const fsp = require('node:fs').promises;
const path = require('node:path');

const { commandExists, commandOutput, runCommand } = require('./commands');
const { detectGit, fileExists } = require('./detect');

const initGit = (targetDir, dryRun) => {
  runCommand('git', ['-C', targetDir, 'init'], targetDir, dryRun);
};

const replaceGit = async (targetDir, dryRun) => {
  const gitPath = path.join(targetDir, '.git');
  if (!(await fileExists(gitPath))) {
    throw new Error('Cannot replace git because target directory has no own .git directory');
  }
  if (dryRun) {
    console.log(`dry-run command: rm -rf ${gitPath}`);
  } else {
    await fsp.rm(gitPath, { force: true, recursive: true });
  }
  initGit(targetDir, dryRun);
};

const configureRemote = (targetDir, name, url, dryRun) => {
  if (!url) {
    return;
  }
  const existing = commandOutput('git', ['-C', targetDir, 'remote', 'get-url', name]);
  if (existing) {
    runCommand('git', ['-C', targetDir, 'remote', 'set-url', name, url], targetDir, dryRun);
  } else {
    runCommand('git', ['-C', targetDir, 'remote', 'add', name, url], targetDir, dryRun);
  }
};

const gitAddIntent = async (targetDir, files, dryRun) => {
  const existing = [];
  for (const file of files) {
    if (await fileExists(path.join(targetDir, file))) {
      existing.push(file);
    }
  }
  if (existing.length === 0) {
    return;
  }
  runCommand('git', ['-C', targetDir, 'add', '-N', '--', ...existing], targetDir, dryRun);
};

const applyGit = async ({ answers, targetDir, workspace }) => {
  if (answers.gitMode === 'skip') {
    workspace.skipped.push('git skipped');
    return;
  }
  if (!commandExists('git')) {
    workspace.skipped.push('git not found');
    return;
  }

  const before = detectGit(targetDir);
  if (answers.gitMode === 'replace') {
    await replaceGit(targetDir, answers.dryRun);
  } else if (answers.gitMode === 'init') {
    if (before.hasOwnGit) {
      workspace.skipped.push('git already initialized');
    } else {
      initGit(targetDir, answers.dryRun);
    }
  } else if (answers.gitMode === 'keep' && !before.inside && !answers.gitRemote) {
    workspace.skipped.push('no git repo to keep');
  }

  const after = detectGit(targetDir);
  if (!after.inside && answers.gitMode !== 'skip' && !answers.dryRun) {
    workspace.skipped.push('no git repo after git setup');
    return;
  }

  if (answers.gitRemote) {
    configureRemote(targetDir, answers.gitRemoteName, answers.gitRemote, answers.dryRun);
  }

  if (answers.gitAdd) {
    await gitAddIntent(targetDir, Array.from(workspace.touchedFiles), answers.dryRun);
  }
};

module.exports = {
  applyGit,
};
