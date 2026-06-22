'use strict';

const path = require('node:path');

const { displayCommand, runCommand, runCommandCaptured } = require('./commands');
const { isDirEmpty } = require('./detect');
const {
  hasPnpmIgnoredBuilds,
  logPnpmBuildsApproved,
  logPnpmBuildsNotApproved,
  logPnpmBuildsNotNeeded,
  pnpmIgnoredBuildPackages,
  pnpmIgnoredBuildsLabel,
} = require('./pnpm-builds');
const { createPrompter, promptYesNo } = require('./ui');

const OWNED_FOUNDATION = 'owned';
const FOUNDATION_CHOICES = [
  { label: 'custom', value: OWNED_FOUNDATION },
  { label: 'Next.js', value: 'next' },
  { label: 'Nuxt', value: 'nuxt' },
  { label: 'React + Vite', value: 'react-vite' },
  { label: 'Vue + Vite', value: 'vue-vite' },
];

const SEEDED_FOUNDATIONS = new Set(['next', 'nuxt', 'react-vite', 'vue-vite']);
const APP_SEEDS = new Set(['next', 'nuxt']);
const VITE_SEEDS = new Set(['react-vite', 'vue-vite']);

const isOwnedFoundation = (foundation) => foundation === OWNED_FOUNDATION;
const isSeededFoundation = (foundation) => SEEDED_FOUNDATIONS.has(foundation);
const isAppSeed = (foundation) => APP_SEEDS.has(foundation);
const isViteSeed = (foundation) => VITE_SEEDS.has(foundation);
const isReactFoundation = (foundation) => foundation === 'next' || foundation === 'react-vite';
const isVueFoundation = (foundation) => foundation === 'nuxt' || foundation === 'vue-vite';
const isNuxtFoundation = (foundation) => foundation === 'nuxt';
const isNextFoundation = (foundation) => foundation === 'next';

const foundationLabel = (foundation, config) => {
  if (foundation === OWNED_FOUNDATION) {
    return 'custom';
  }
  return config.seedCommands[foundation]?.label ?? foundation;
};

const replaceTokens = (value, values) =>
  value.replace(/\$\{([A-Za-z0-9_]+)\}/g, (match, key) => {
    if (!(key in values)) {
      throw new Error(`Seed command template references unknown value: ${match}`);
    }
    return values[key];
  });

const buildAppSeedCommand = ({ answers, config, targetDir }) => {
  const seed = config.seedCommands[answers.foundation];
  if (!seed?.commandArgs) {
    throw new Error(`Unknown seed foundation: ${answers.foundation}`);
  }
  const manager = config.packageManagers[answers.toolchainManager];
  const version = answers.seedVersion || 'latest';
  const packageSpec = `${seed.commandPackage}@${version}`;
  const values = {
    installFlag: isNuxtFoundation(answers.foundation)
      ? '--no-install'
      : answers.install
        ? ''
        : '--skip-install',
    nuxtOfflineFlag: isNuxtFoundation(answers.foundation) && answers.nuxtOffline ? '--offline' : '',
    nuxtPreferOfflineFlag:
      isNuxtFoundation(answers.foundation) && answers.nuxtPreferOffline ? '--preferOffline' : '',
    packageManager: manager.nuxtValue || answers.toolchainManager,
    packageManagerFlag: manager.nextFlag || '',
    tailwindFlag: answers.tailwind ? '--tailwind' : '--no-tailwind',
    targetDir,
    typescriptFlag: answers.typescript ? '--ts' : '--js',
  };
  const args = [
    '--yes',
    packageSpec,
    ...seed.commandArgs.map((arg) => replaceTokens(arg, values)).filter(Boolean),
  ];
  return { command: 'npx', args };
};

const buildReactViteSeedCommand = ({ answers, targetDir }) => {
  const template = answers.typescript ? 'react-ts' : 'react';
  const version = answers.seedVersion || 'latest';
  return {
    command: 'npm',
    args: ['create', `vite@${version}`, targetDir, '--', '--template', template, '--no-interactive'],
  };
};

const buildVueViteSeedCommand = ({ answers, targetDir }) => {
  const version = answers.seedVersion || 'latest';
  const featureFlags = [];
  if (answers.typescript) featureFlags.push('--ts');
  if (answers.jsx) featureFlags.push('--jsx');
  if (answers.router) featureFlags.push('--router');
  if (answers.pinia) featureFlags.push('--pinia');
  if (answers.vitest) featureFlags.push('--vitest');
  if (answers.eslint) featureFlags.push('--eslint');
  if (answers.prettier) featureFlags.push('--prettier');
  if (featureFlags.length === 0) featureFlags.push('--default');
  return {
    command: 'npm',
    args: ['create', `vue@${version}`, '--', ...featureFlags, targetDir],
  };
};

const buildSeedCommand = ({ answers, config, targetDir }) => {
  if (isOwnedFoundation(answers.foundation)) {
    return null;
  }
  if (isAppSeed(answers.foundation)) {
    return buildAppSeedCommand({ answers, config, targetDir });
  }
  if (answers.foundation === 'react-vite') {
    return buildReactViteSeedCommand({ answers, targetDir });
  }
  if (answers.foundation === 'vue-vite') {
    return buildVueViteSeedCommand({ answers, targetDir });
  }
  throw new Error(`Unknown foundation: ${answers.foundation}`);
};

const shortCommandDisplay = (command, args, targetDir) => {
  const resolvedTarget = path.resolve(targetDir);
  const targetName = path.basename(resolvedTarget);
  return displayCommand(
    command,
    args.map((arg) => (arg === resolvedTarget || arg === targetDir ? targetName : arg)),
  );
};

const shouldHandlePnpmSeedInstall = ({ answers, result }) =>
  answers.toolchainManager === 'pnpm' && answers.install && hasPnpmIgnoredBuilds(result);

const recoverPnpmSeedInstall = async ({ config, targetDir, dryRun, workspace }) => {
  const installCommand = config.packageManagers.pnpm.installCommand;
  await runCommand('pnpm', ['approve-builds', '--all'], targetDir, dryRun, {
    label: 'pnpm approval command',
  });
  await runCommand(installCommand[0], installCommand.slice(1), targetDir, dryRun, {
    label: 'pnpm install retry command',
  });
  logPnpmBuildsApproved(workspace);
};

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

const handlePnpmSeedInstall = async ({ answers, config, targetDir, dryRun, workspace, interactive, result }) => {
  const packages = pnpmIgnoredBuildPackages(result);
  if (await shouldApprovePnpmBuilds({ answers, interactive, packages })) {
    await recoverPnpmSeedInstall({ config, targetDir, dryRun, workspace });
    return true;
  }
  logPnpmBuildsNotApproved(workspace, packages);
  return true;
};

const runSeedCommand = async ({
  answers,
  config,
  command,
  args,
  commandDisplay,
  cwd,
  targetDir,
  dryRun,
  workspace,
  interactive,
}) => {
  let result;
  try {
    result = await runCommandCaptured(command, args, cwd, dryRun, {
      display: commandDisplay,
      label: 'seed command',
    });
  } catch (error) {
    if (!shouldHandlePnpmSeedInstall({ answers, result: error })) {
      throw error;
    }
    return await handlePnpmSeedInstall({ answers, config, targetDir, dryRun, workspace, interactive, result: error });
  }
  if (shouldHandlePnpmSeedInstall({ answers, result })) {
    return await handlePnpmSeedInstall({ answers, config, targetDir, dryRun, workspace, interactive, result });
  }
  return false;
};

const runSeedPass = async ({ answers, config, targetDir, dryRun, force, workspace, interactive }) => {
  if (!isSeededFoundation(answers.foundation)) {
    return null;
  }
  const empty = await isDirEmpty(targetDir);
  if (!empty && !force) {
    throw new Error(
      `${foundationLabel(answers.foundation, config)} seed foundation requires an empty target directory. Re-run with --force to let the seed command attempt it anyway.`,
    );
  }
  const resolvedTarget = path.resolve(targetDir);
  const commandTarget = isViteSeed(answers.foundation) ? path.basename(resolvedTarget) : resolvedTarget;
  const { command, args } = buildSeedCommand({ answers, config, targetDir: commandTarget });
  const commandDisplay = shortCommandDisplay(command, args, targetDir);
  const handledPnpmIgnoredBuilds = await runSeedCommand({
    answers,
    config,
    command,
    args,
    commandDisplay,
    cwd: path.dirname(resolvedTarget),
    targetDir: resolvedTarget,
    dryRun,
    workspace,
    interactive,
  });
  if (answers.toolchainManager === 'pnpm' && answers.install && !handledPnpmIgnoredBuilds) {
    logPnpmBuildsNotNeeded(workspace);
  }
  return { commandDisplay, foundation: answers.foundation };
};

module.exports = {
  FOUNDATION_CHOICES,
  OWNED_FOUNDATION,
  buildSeedCommand,
  foundationLabel,
  isAppSeed,
  isNextFoundation,
  isNuxtFoundation,
  isOwnedFoundation,
  isReactFoundation,
  isSeededFoundation,
  isViteSeed,
  isVueFoundation,
  runSeedPass,
};
