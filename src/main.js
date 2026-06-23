'use strict';

const fsp = require('node:fs').promises;
const path = require('node:path');

const { parseArgs, printRequestedHelp } = require('./cli');
const { commandExists, runCommand, runCommandCaptured } = require('./commands');
const { loadConfig } = require('./config');
const { fileExists, isDirEmpty, readJsonFile, statOrNull } = require('./detect');
const {
  foundationLabel,
  isNextFoundation,
  isSeededFoundation,
  runSeedPass,
  shouldDeferAppSeedInstall,
} = require('./foundations');
const {
  commitSeedOutput,
  prepareGit,
  replaceGitWithInitialCommit,
  stageForNix,
  stageGit,
} = require('./git');
const { applySeededFoundationOverrides } = require('./override-pass');
const {
  applyAgents,
  applyCommon,
  applyLicense,
  applyOwnedFoundationTemplates,
  applyNix,
  applyPackageJson,
  applyPnpmWorkspace,
  applyReadme,
  applyTsMode,
  applyTypescriptConfig,
} = require('./project');
const {
  hasPnpmIgnoredBuilds,
  logPnpmBuildsApproved,
  logPnpmBuildsNotApproved,
  logPnpmBuildsNotNeeded,
  pnpmIgnoredBuildPackages,
  pnpmIgnoredBuildsLabel,
} = require('./pnpm-builds');
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

const resolveTargetMode = async (targetDir) => ((await isDirEmpty(targetDir)) ? 'fresh' : 'overlay');

const runInstallCommand = ({ command, args, targetDir, dryRun }) =>
  runCommandCaptured(command, args, targetDir, dryRun);

const shouldApprovePnpmBuilds = async ({ answers, interactive, packages }) => {
  if (answers.pnpmApproveBuilds) {
    return true;
  }
  if (!interactive) {
    return false;
  }
  const rl = createPrompter();
  try {
    return await promptYesNo(
      rl,
      `Approve pnpm build scripts now (${pnpmIgnoredBuildsLabel(packages)})?`,
      true,
    );
  } finally {
    rl.close();
  }
};

const runPnpmInstallWithApproval = async ({
  answers,
  command,
  args,
  approveCommand,
  approveArgs,
  targetDir,
  workspace,
  interactive,
}) => {
  const recover = async (result) => {
    const packages = pnpmIgnoredBuildPackages(result);
    if (!(await shouldApprovePnpmBuilds({ answers, interactive, packages }))) {
      logPnpmBuildsNotApproved(workspace, packages);
      return true;
    }
    await runCommand(approveCommand, approveArgs, targetDir, answers.dryRun, {
      label: 'pnpm approval command',
    });
    await runCommandCaptured(command, args, targetDir, answers.dryRun, {
      label: 'pnpm install retry command',
    });
    logPnpmBuildsApproved(workspace);
    return true;
  };

  let result;
  try {
    result = await runInstallCommand({ command, args, targetDir, dryRun: answers.dryRun });
  } catch (error) {
    if (answers.toolchainManager !== 'pnpm' || !hasPnpmIgnoredBuilds(error)) {
      throw error;
    }
    return recover(error);
  }
  if (answers.toolchainManager === 'pnpm' && hasPnpmIgnoredBuilds(result)) {
    return recover(result);
  }
  return false;
};

const runPostChecks = async ({ answers, config, targetDir, workspace, interactive }) => {
  if (answers.direnv) {
    if (commandExists('direnv')) {
      await runCommand('direnv', ['allow'], targetDir, answers.dryRun);
    } else {
      workspace.skipped.push('direnv not found');
    }
  }

  if (answers.flakeLock) {
    if (commandExists('nix')) {
      await runCommand('nix', ['flake', 'lock'], targetDir, answers.dryRun);
      workspace.mark('flake.lock');
      await stageForNix({ answers, targetDir, workspace });
    } else {
      workspace.skipped.push('nix not found');
    }
  }

  if (answers.install && isNextFoundation(answers.foundation) && !shouldDeferAppSeedInstall(answers)) {
    workspace.skipped.push('package install handled by seed command');
  } else if (answers.install) {
    const installCommand = config.packageManagers[answers.toolchainManager].installCommand;
    if (answers.nix && commandExists('nix') && (await fileExists(path.join(targetDir, 'flake.nix')))) {
      const handledPnpmIgnoredBuilds = await runPnpmInstallWithApproval({
        answers,
        command: 'nix',
        args: ['develop', '--command', ...installCommand],
        approveCommand: 'nix',
        approveArgs: ['develop', '--command', 'pnpm', 'approve-builds', '--all'],
        targetDir,
        workspace,
        interactive,
      });
      if (answers.toolchainManager === 'pnpm' && !handledPnpmIgnoredBuilds) {
        logPnpmBuildsNotNeeded(workspace);
      }
    } else {
      const handledPnpmIgnoredBuilds = await runPnpmInstallWithApproval({
        answers,
        command: installCommand[0],
        args: installCommand.slice(1),
        approveCommand: 'pnpm',
        approveArgs: ['approve-builds', '--all'],
        targetDir,
        workspace,
        interactive,
      });
      if (answers.toolchainManager === 'pnpm' && !handledPnpmIgnoredBuilds) {
        logPnpmBuildsNotNeeded(workspace);
      }
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
    await runCommand('npx', ['--no-install', 'prettier', '--write', '.'], targetDir, answers.dryRun);
  } else {
    if (answers.tailwind) {
      workspace.skipped.push('Tailwind Prettier plugin not installed; formatting without project config');
    }
    await runCommand(
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

const formatSkippedLine = (line) => {
  if (line && typeof line === 'object' && line.level === 'error') {
    const firstLine = [
      color.red('-'),
      color.red('skipped'.padEnd(9)),
      color.red(line.textBefore || ''),
    ].join(' ');
    const indent = '  '.repeat(1) + ' '.repeat(10);
    const secondLine = `${indent}${color.red('run')} ${color.bold(line.command)} ${color.red(line.textAfter || '')}`;
    return `${firstLine}\n${color.dim('│')} ${secondLine}`;
  }
  return `${color.yellow('-')} ${color.yellow('skipped'.padEnd(9))} ${line}`;
};

const printSummary = ({ answers, config, mode, targetDir, workspace }) => {
  console.log('');
  console.log(`${color.green('◇')} ${color.bold('scaffold')} ${color.dim(targetDir)}`);
  for (const line of workspace.changed) {
    console.log(`${color.dim('│')} ${formatChangeLine(line)}`);
  }
  for (const line of workspace.skipped) {
    console.log(`${color.dim('│')} ${formatSkippedLine(line)}`);
  }
  if (workspace.changed.length === 0 && workspace.skipped.length === 0) {
    console.log(`${color.dim('│')} ${color.dim('no file changes')}`);
  }
  console.log(`${color.dim('│')} ${color.dim('mode:')} ${mode}`);
  if (answers.nodeProject) {
    const version = isSeededFoundation(answers.foundation) ? `@${answers.seedVersion}` : '';
    console.log(
      `${color.dim('│')} ${color.dim('foundation:')} ${foundationLabel(answers.foundation, config)}${version}`,
    );
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

  const mode = await resolveTargetMode(targetDir);
  let existingPackage = await readExistingPackage(targetDir);
  const answers = await resolveAnswers({ opts, targetDir, mode, existingPackage, config });

  const workspace = new Workspace({
    targetDir,
    dryRun: answers.dryRun,
    backup: answers.backup && answers.gitMode === 'skip',
    force: answers.force,
  });
  const hadTsconfig = await fileExists(path.join(targetDir, 'tsconfig.json'));

  await replaceGitWithInitialCommit({ answers, targetDir, workspace });

  const seedRun = await runSeedPass({
    answers,
    config,
    targetDir,
    dryRun: answers.dryRun,
    force: answers.force,
    workspace,
    interactive,
  });
  await commitSeedOutput({
    answers,
    commandDisplay: seedRun?.commandDisplay,
    targetDir,
    workspace,
  });

  if (!answers.dryRun) {
    existingPackage = await readExistingPackage(targetDir);
  }

  await applyCommon({ workspace, answers });
  await applyNix({ workspace, answers, config });
  await applyTypescriptConfig(workspace, answers);
  await applyOwnedFoundationTemplates(workspace, answers);
  await applySeededFoundationOverrides({ workspace, answers, seedRun });
  await applyPnpmWorkspace({ workspace, answers });
  if (!answers.dryRun) {
    existingPackage = await readExistingPackage(targetDir);
  }
  await applyPackageJson({ workspace, answers, existingPackage, config });
  await applyReadme({ workspace });
  if (
    answers.typescript &&
    (hadTsconfig || answers.tsMode === 'non-strict' || isSeededFoundation(answers.foundation))
  ) {
    await applyTsMode(workspace, answers.tsMode);
  }
  await applyLicense({ workspace, answers, config });
  await applyAgents({ workspace, answers, config });
  await prepareGit({ answers, targetDir, workspace });
  await stageForNix({ answers, targetDir, workspace });
  await runPostChecks({ answers, config, targetDir, workspace, interactive });
  await runFinalFormat({ answers, config, targetDir, workspace });
  await stageGit({ answers, targetDir, workspace });

  printSummary({ answers, config, mode, targetDir, workspace });
};

module.exports = {
  main,
};
