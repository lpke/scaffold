'use strict';

const fsp = require('node:fs').promises;
const path = require('node:path');

const { parseArgs, printRequestedHelp } = require('./cli');
const { commandExists, runCommand } = require('./commands');
const { loadConfig } = require('./config');
const { fileExists, readJsonFile, statOrNull } = require('./detect');
const { runFramework } = require('./frameworks');
const { prepareGit, replaceGitWithInitialCommit, stageForNix, stageGit } = require('./git');
const {
  applyAgents,
  applyCommon,
  applyLicense,
  applyLocalStarter,
  applyNix,
  applyNextTsconfig,
  applyPackageJson,
  applyPnpmWorkspace,
  applyReadme,
  applyTsMode,
  applyTypescriptConfig,
} = require('./project');
const { isInteractive, resolveAnswers } = require('./prompts');
const { color, createPrompter, intro, promptYesNo } = require('./ui');
const { Workspace } = require('./workspace');

const ensureTargetDir = async (targetDir, opts) => {
  const stat = await statOrNull(targetDir);
  if (stat && !stat.isDirectory()) {
    throw new Error(`Target exists but is not a directory: ${targetDir}`);
  }
  if (stat) {
    return;
  }

  if (isInteractive(opts)) {
    const rl = createPrompter();
    try {
      const create = await promptYesNo(rl, `Create ${targetDir}?`, true);
      if (!create) {
        throw new Error('Cancelled');
      }
    } finally {
      rl.close();
    }
  }

  if (!opts.dryRun) {
    await fsp.mkdir(targetDir, { recursive: true });
  }
};

const readExistingPackage = async (targetDir) => {
  const packagePath = path.join(targetDir, 'package.json');
  return (await fileExists(packagePath)) ? readJsonFile(packagePath) : null;
};

const runPostChecks = async ({ answers, config, targetDir, workspace }) => {
  if (answers.direnv) {
    if (commandExists('direnv')) {
      runCommand('direnv', ['allow'], targetDir, answers.dryRun);
    } else {
      workspace.skipped.push('direnv not found');
    }
  }

  if (answers.flakeLock) {
    if (commandExists('nix')) {
      runCommand('nix', ['flake', 'lock'], targetDir, answers.dryRun);
      workspace.mark('flake.lock');
      await stageForNix({ answers, targetDir, workspace });
    } else {
      workspace.skipped.push('nix not found');
    }
  }

  if (answers.install && answers.framework !== 'none') {
    workspace.skipped.push('package install handled by framework generator');
  } else if (answers.install) {
    const installCommand = config.packageManagers[answers.toolchainManager].installCommand;
    if (answers.nix && commandExists('nix') && (await fileExists(path.join(targetDir, 'flake.nix')))) {
      runCommand('nix', ['develop', '--command', ...installCommand], targetDir, answers.dryRun);
    } else {
      runCommand(installCommand[0], installCommand.slice(1), targetDir, answers.dryRun);
    }
  }
};

const printSummary = ({ answers, targetDir, workspace }) => {
  console.log('');
  console.log(`${color.green('◇')} ${color.bold('scaffold')} ${color.dim(targetDir)}`);
  for (const line of workspace.changed) {
    console.log(`${color.dim('│')} ${color.green('+')} ${line}`);
  }
  for (const line of workspace.skipped) {
    console.log(`${color.dim('│')} ${color.yellow('-')} skipped: ${line}`);
  }
  if (workspace.changed.length === 0 && workspace.skipped.length === 0) {
    console.log(`${color.dim('│')} ${color.dim('no file changes')}`);
  }
  if (answers.framework !== 'none') {
    console.log(`${color.dim('│')} ${color.dim('framework:')} ${answers.framework}@${answers.frameworkVersion}`);
  }
  console.log(`${color.dim('└')} ${color.green('done')}`);
};

const main = async () => {
  const argv = process.argv.slice(2);
  if (printRequestedHelp(argv)) {
    return;
  }

  const opts = parseArgs(argv);
  const targetDir = path.resolve(opts.dir ?? process.cwd());
  const config = await loadConfig();
  const interactive = isInteractive(opts);

  if (interactive) {
    intro('Scaffold Project');
  }

  await ensureTargetDir(targetDir, opts);

  let existingPackage = await readExistingPackage(targetDir);
  const answers = await resolveAnswers({ opts, targetDir, existingPackage, config });

  const workspace = new Workspace({
    targetDir,
    dryRun: answers.dryRun,
    backup: answers.backup,
    force: answers.force,
  });
  const hadTsconfig = await fileExists(path.join(targetDir, 'tsconfig.json'));

  await replaceGitWithInitialCommit({ answers, targetDir, workspace });

  await runFramework({
    answers,
    config,
    targetDir,
    dryRun: answers.dryRun,
    force: answers.force,
  });

  if (!answers.dryRun) {
    existingPackage = await readExistingPackage(targetDir);
  }

  await applyCommon({ workspace, answers });
  await applyNix({ workspace, answers, config });
  await applyTypescriptConfig(workspace, answers);
  await applyLocalStarter(workspace, answers);
  await applyPnpmWorkspace({ workspace, answers });
  await applyPackageJson({ workspace, answers, existingPackage, config });
  await applyReadme({ workspace });
  if (
    answers.typescript &&
    (hadTsconfig || answers.tsMode === 'non-strict' || answers.framework !== 'none')
  ) {
    await applyTsMode(workspace, answers.tsMode);
  }
  await applyNextTsconfig(workspace, answers);
  await applyLicense({ workspace, answers, config });
  await applyAgents({ workspace, answers });
  await prepareGit({ answers, targetDir, workspace });
  await stageForNix({ answers, targetDir, workspace });
  await runPostChecks({ answers, config, targetDir, workspace });
  await stageGit({ answers, targetDir, workspace });

  printSummary({ answers, targetDir, workspace });
};

module.exports = {
  main,
};
