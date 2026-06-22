'use strict';

const fsp = require('node:fs').promises;
const path = require('node:path');

const { parseArgs, printRequestedHelp } = require('./cli');
const { commandExists, runCommand } = require('./commands');
const { loadConfig } = require('./config');
const { fileExists, readJsonFile, statOrNull } = require('./detect');
const { runFramework, runFrontendBase } = require('./frameworks');
const {
  commitBaseScaffold,
  prepareGit,
  replaceGitWithInitialCommit,
  stageForNix,
  stageGit,
} = require('./git');
const { applyTemplateOverrides } = require('./overrides');
const {
  applyAgents,
  applyCommon,
  applyLicense,
  applyLocalStarter,
  applyNix,
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

  if (answers.install && answers.framework === 'next') {
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

const runFinalFormat = async ({ answers, config, targetDir, workspace }) => {
  if (!answers.prettier) {
    return;
  }
  const hasPrettier = await fileExists(path.join(targetDir, 'node_modules', 'prettier'));
  const hasTailwindPlugin =
    !answers.tailwind ||
    (await fileExists(path.join(targetDir, 'node_modules', 'prettier-plugin-tailwindcss')));
  if (hasPrettier && hasTailwindPlugin) {
    runCommand('npx', ['--no-install', 'prettier', '--write', '.'], targetDir, answers.dryRun);
  } else {
    if (answers.tailwind) {
      workspace.skipped.push('Tailwind Prettier plugin not installed; formatting without project config');
    }
    runCommand(
      'npx',
      [
        '--yes',
        '--package',
        `prettier@${config.versions.prettier}`,
        'prettier',
        '--write',
        '.',
        '--ignore-unknown',
        '--single-quote',
        '--no-config',
      ],
      targetDir,
      answers.dryRun,
    );
  }
  workspace.changed.push('formatted project with Prettier');
  if (answers.gitMode !== 'skip') {
    answers.gitAdd = true;
  }
};

const changeStyle = (descriptor) => {
  const styles = {
    committed: { symbol: '*', color: color.green },
    created: { symbol: '+', color: color.green },
    deleted: { symbol: 'x', color: color.red },
    formatted: { symbol: '~', color: color.cyan },
    merged: { symbol: '=', color: color.blue },
    modified: { symbol: '~', color: color.cyan },
    moved: { symbol: '>', color: color.yellow },
    replaced: { symbol: '!', color: color.yellow },
    updated: { symbol: '~', color: color.cyan },
  };
  return styles[descriptor] ?? { symbol: '*', color: color.cyan };
};

const formatChangeLine = (line) => {
  const [descriptor, ...rest] = line.split(' ');
  const style = changeStyle(descriptor);
  return `${style.color(style.symbol)} ${style.color(descriptor.padEnd(9))} ${rest.join(' ')}`;
};

const printSummary = ({ answers, targetDir, workspace }) => {
  console.log('');
  console.log(`${color.green('◇')} ${color.bold('scaffold')} ${color.dim(targetDir)}`);
  for (const line of workspace.changed) {
    console.log(`${color.dim('│')} ${formatChangeLine(line)}`);
  }
  for (const line of workspace.skipped) {
    console.log(`${color.dim('│')} ${color.yellow('-')} ${color.yellow('skipped'.padEnd(9))} ${line}`);
  }
  if (workspace.changed.length === 0 && workspace.skipped.length === 0) {
    console.log(`${color.dim('│')} ${color.dim('no file changes')}`);
  }
  if (answers.framework !== 'none') {
    console.log(`${color.dim('│')} ${color.dim('framework:')} ${answers.framework}@${answers.frameworkVersion}`);
  }
  if (answers.frontendBase && answers.frontendBase !== 'none') {
    console.log(`${color.dim('│')} ${color.dim('frontend base:')} ${answers.frontendBase}`);
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
    backup: answers.backup && answers.gitMode === 'skip',
    force: answers.force,
  });
  const hadTsconfig = await fileExists(path.join(targetDir, 'tsconfig.json'));

  await replaceGitWithInitialCommit({ answers, targetDir, workspace });

  const frameworkRun = await runFramework({
    answers,
    config,
    targetDir,
    dryRun: answers.dryRun,
    force: answers.force,
  });
  await commitBaseScaffold({
    answers,
    commandDisplay: frameworkRun?.commandDisplay,
    targetDir,
    workspace,
  });
  const frontendBaseRun = await runFrontendBase({
    answers,
    targetDir,
    dryRun: answers.dryRun,
    force: answers.force,
  });
  await commitBaseScaffold({
    answers,
    commandDisplay: frontendBaseRun?.commandDisplay,
    targetDir,
    workspace,
  });

  if (!answers.dryRun) {
    existingPackage = await readExistingPackage(targetDir);
  }

  await applyCommon({ workspace, answers });
  await applyNix({ workspace, answers, config });
  await applyTypescriptConfig(workspace, answers);
  await applyLocalStarter(workspace, answers);
  await applyTemplateOverrides({ workspace, answers, frameworkRun, frontendBaseRun });
  await applyPnpmWorkspace({ workspace, answers });
  await applyPackageJson({ workspace, answers, existingPackage, config });
  await applyReadme({ workspace });
  if (
    answers.typescript &&
    (hadTsconfig || answers.tsMode === 'non-strict' || answers.framework !== 'none')
  ) {
    await applyTsMode(workspace, answers.tsMode);
  }
  await applyLicense({ workspace, answers, config });
  await applyAgents({ workspace, answers });
  await prepareGit({ answers, targetDir, workspace });
  await stageForNix({ answers, targetDir, workspace });
  await runPostChecks({ answers, config, targetDir, workspace });
  await runFinalFormat({ answers, config, targetDir, workspace });
  await stageGit({ answers, targetDir, workspace });

  printSummary({ answers, targetDir, workspace });
};

module.exports = {
  main,
};
