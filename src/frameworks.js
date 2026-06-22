'use strict';

const path = require('node:path');

const { displayCommand, runCommand } = require('./commands');
const { isDirEmpty } = require('./detect');
const { color } = require('./ui');

const replaceTokens = (value, values) =>
  value.replace(/\$\{([A-Za-z0-9_]+)\}/g, (match, key) => {
    if (!(key in values)) {
      throw new Error(`Framework command template references unknown value: ${match}`);
    }
    return values[key];
  });

const frameworkCommand = ({ answers, config, targetDir }) => {
  const framework = config.frameworks[answers.framework];
  if (!framework) {
    throw new Error(`Unknown framework: ${answers.framework}`);
  }
  const manager = config.packageManagers[answers.toolchainManager];
  const version = answers.frameworkVersion || 'latest';
  const packageSpec = `${framework.commandPackage}@${version}`;
  const values = {
    installFlag: answers.framework === 'nuxt' ? '--no-install' : answers.install ? '' : '--skip-install',
    nuxtOfflineFlag: answers.framework === 'nuxt' && answers.nuxtOffline ? '--offline' : '',
    nuxtPreferOfflineFlag: answers.framework === 'nuxt' && answers.nuxtPreferOffline ? '--preferOffline' : '',
    packageManager: manager.nuxtValue || answers.toolchainManager,
    packageManagerFlag: manager.nextFlag || '',
    tailwindFlag: answers.tailwind ? '--tailwind' : '--no-tailwind',
    targetDir,
    typescriptFlag: answers.typescript ? '--ts' : '--js',
  };
  const args = [
    '--yes',
    packageSpec,
    ...framework.commandArgs.map((arg) => replaceTokens(arg, values)).filter(Boolean),
  ];
  return { command: 'npx', args };
};

const frontendBaseCommand = ({ answers, targetDir }) => {
  if (answers.frontendBase === 'react') {
    const template = answers.typescript ? 'react-ts' : 'react';
    return {
      command: 'npm',
      args: ['create', 'vite@latest', targetDir, '--', '--template', template, '--no-interactive'],
    };
  }
  if (answers.frontendBase === 'vue') {
    const args = ['create', 'vue@latest', targetDir];
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
      args: [...args, '--', ...featureFlags],
    };
  }
  throw new Error(`Unknown frontend base: ${answers.frontendBase}`);
};

const shortCommandDisplay = (command, args, targetDir) => {
  const resolvedTarget = path.resolve(targetDir);
  const targetName = path.basename(resolvedTarget);
  return displayCommand(
    command,
    args.map((arg) => (arg === resolvedTarget || arg === targetDir ? targetName : arg)),
  );
};

const runFrontendBase = async ({ answers, targetDir, dryRun, force }) => {
  if (!answers.frontendBase || answers.frontendBase === 'none') {
    return null;
  }
  const empty = await isDirEmpty(targetDir);
  if (!empty && !force) {
    throw new Error(
      `${answers.frontendBase === 'react' ? 'React + Vite' : 'Vue + Vite'} generator requires an empty target directory. Re-run with --force to let the generator attempt it anyway.`,
    );
  }
  const resolvedTarget = path.resolve(targetDir);
  const { command, args } = frontendBaseCommand({ answers, targetDir: path.basename(resolvedTarget) });
  const commandDisplay = displayCommand(command, args);
  console.log(color.dim(`frontend base command: ${commandDisplay}`));
  runCommand(command, args, path.dirname(resolvedTarget), dryRun);
  return { commandDisplay };
};

const runFramework = async ({ answers, config, targetDir, dryRun, force }) => {
  if (answers.framework === 'none') {
    return null;
  }
  const empty = await isDirEmpty(targetDir);
  if (!empty && !force) {
    throw new Error(
      `${config.frameworks[answers.framework].label} generator requires an empty target directory. Re-run with --force to let the generator attempt it anyway.`,
    );
  }
  const { command, args } = frameworkCommand({ answers, config, targetDir: path.resolve(targetDir) });
  const commandDisplay = shortCommandDisplay(command, args, targetDir);
  console.log(color.dim(`framework command: ${commandDisplay}`));
  runCommand(command, args, path.dirname(path.resolve(targetDir)), dryRun);
  return { commandDisplay };
};

module.exports = {
  frontendBaseCommand,
  runFrontendBase,
  frameworkCommand,
  runFramework,
};
