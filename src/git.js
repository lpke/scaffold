'use strict';

const fsp = require('node:fs').promises;
const path = require('node:path');

const { commandExists, commandOutput, printCommand, runCommand } = require('./commands');
const { detectGit, fileExists } = require('./detect');

const initGit = async (targetDir, dryRun) => {
  await runCommand('git', ['-C', targetDir, 'init'], targetDir, dryRun);
  await runCommand('git', ['-C', targetDir, 'branch', '-M', 'main'], targetDir, dryRun);
};

const replaceGit = async (targetDir, dryRun) => {
  const gitPath = path.join(targetDir, '.git');
  if (!(await fileExists(gitPath))) {
    throw new Error('Cannot replace git because target directory has no own .git directory');
  }
  if (dryRun) {
    printCommand(`rm -rf ${gitPath}`, { dryRun });
  } else {
    await fsp.rm(gitPath, { force: true, recursive: true });
  }
  await initGit(targetDir, dryRun);
};

const configureRemote = async (targetDir, name, url, dryRun) => {
  if (!url) {
    return;
  }
  const existing = commandOutput('git', ['-C', targetDir, 'remote', 'get-url', name]);
  if (existing) {
    await runCommand('git', ['-C', targetDir, 'remote', 'set-url', name, url], targetDir, dryRun);
  } else {
    await runCommand('git', ['-C', targetDir, 'remote', 'add', name, url], targetDir, dryRun);
  }
};

const configureMainTracking = async (targetDir, name, dryRun) => {
  await runCommand('git', ['-C', targetDir, 'config', 'branch.main.remote', name], targetDir, dryRun);
  await runCommand('git', ['-C', targetDir, 'config', 'branch.main.merge', 'refs/heads/main'], targetDir, dryRun);
};

const pushMain = async (targetDir, name, dryRun) => {
  await runCommand('git', ['-C', targetDir, 'push', '-u', name, 'main'], targetDir, dryRun);
};

const gitAddAll = async (targetDir, dryRun) => {
  await runCommand('git', ['-C', targetDir, 'add', '--all', '--', '.'], targetDir, dryRun);
};

const gitCommitPath = async (targetDir, message, dryRun) => {
  await runCommand(
    'git',
    [
      '-C',
      targetDir,
      '-c',
      'user.name=scaffold',
      '-c',
      'user.email=scaffold@localhost',
      'commit',
      '--allow-empty',
      '-m',
      message,
      '--',
      '.',
    ],
    targetDir,
    dryRun,
  );
};

const commitInitial = async (targetDir, dryRun) => {
  await runCommand(
    'git',
    [
      '-C',
      targetDir,
      '-c',
      'user.name=scaffold',
      '-c',
      'user.email=scaffold@localhost',
      'commit',
      '--allow-empty',
      '-m',
      'initial commit',
    ],
    targetDir,
    dryRun,
  );
};

const replaceGitWithInitialCommit = async ({ answers, targetDir, workspace }) => {
  if (answers.gitMode !== 'replace') {
    return;
  }
  if (!commandExists('git')) {
    workspace.skipped.push('git not found');
    return;
  }

  await replaceGit(targetDir, answers.dryRun);
  await gitAddAll(targetDir, answers.dryRun);
  await commitInitial(targetDir, answers.dryRun);
  answers.gitMode = 'keep';
  workspace.changed.push('replaced git repo and committed initial state');
};

const commitSeedOutput = async ({ answers, commandDisplay, targetDir, workspace }) => {
  if (!commandDisplay) {
    return;
  }
  if (answers.gitMode === 'skip') {
    workspace.skipped.push('seed output commit skipped because git is skipped');
    return;
  }
  if (!commandExists('git')) {
    workspace.skipped.push('git not found');
    return;
  }

  const before = detectGit(targetDir);
  if (!before.inside) {
    await initGit(targetDir, answers.dryRun);
  }
  await gitAddAll(targetDir, answers.dryRun);
  await gitCommitPath(targetDir, `seed output from ${commandDisplay}`, answers.dryRun);
  answers.gitAdd = true;
  if (answers.gitMode === 'init') {
    answers.gitMode = 'keep';
  }
  workspace.changed.push('committed seed output');
};

const commitScaffoldOverrides = async ({ answers, targetDir, workspace }) => {
  if (!answers.commitOverrides || answers.gitMode === 'skip') {
    return;
  }
  if (!commandExists('git')) {
    workspace.skipped.push('git not found');
    return;
  }

  const git = detectGit(targetDir);
  if (!git.inside && !answers.dryRun) {
    workspace.skipped.push('no git repo for overrides commit');
    return;
  }

  await gitAddAll(targetDir, answers.dryRun);
  await gitCommitPath(targetDir, 'scaffold overrides', answers.dryRun);
  workspace.changed.push('committed scaffold overrides');
};

const prepareGit = async ({ answers, targetDir, workspace }) => {
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
      await initGit(targetDir, answers.dryRun);
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
    await configureRemote(targetDir, answers.gitRemoteName, answers.gitRemote, answers.dryRun);
    await configureMainTracking(targetDir, answers.gitRemoteName, answers.dryRun);
  }
};

const stageGit = async ({ answers, targetDir, workspace }) => {
  if (answers.gitMode === 'skip' || !answers.gitAdd) {
    return;
  }
  if (!commandExists('git')) {
    return;
  }
  const git = detectGit(targetDir);
  if (!git.inside && !answers.dryRun) {
    workspace.skipped.push('no git repo for staging');
    return;
  }
  if (answers.gitAdd) {
    await gitAddAll(targetDir, answers.dryRun);
  }
};

const pushGit = async ({ answers, targetDir, workspace }) => {
  if (answers.gitMode === 'skip' || !answers.gitPush || !answers.gitRemote) {
    return;
  }
  if (!commandExists('git')) {
    workspace.skipped.push('git not found');
    return;
  }
  const git = detectGit(targetDir);
  if (!git.inside && !answers.dryRun) {
    workspace.skipped.push('no git repo for push');
    return;
  }
  await pushMain(targetDir, answers.gitRemoteName, answers.dryRun);
  workspace.changed.push(`pushed main to ${answers.gitRemoteName}`);
};

const stageForNix = async ({ answers, targetDir, workspace }) => {
  if (!answers.nix || !commandExists('git')) {
    return;
  }
  const git = detectGit(targetDir);
  if (!git.inside && !answers.dryRun) {
    workspace.skipped.push('no git repo for nix staging');
    return;
  }
  await gitAddAll(targetDir, answers.dryRun);
};

module.exports = {
  commitScaffoldOverrides,
  commitSeedOutput,
  prepareGit,
  pushGit,
  replaceGitWithInitialCommit,
  stageForNix,
  stageGit,
};
