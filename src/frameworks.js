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
    installFlag: answers.install ? (answers.framework === 'nuxt' ? '--install' : '') : answers.framework === 'nuxt' ? '--no-install' : '--skip-install',
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

const runFramework = async ({ answers, config, targetDir, dryRun, force }) => {
  if (answers.framework === 'none') {
    return;
  }
  const empty = await isDirEmpty(targetDir);
  if (!empty && !force) {
    throw new Error(
      `${config.frameworks[answers.framework].label} generator requires an empty target directory. Re-run with --force to let the generator attempt it anyway.`,
    );
  }
  const { command, args } = frameworkCommand({ answers, config, targetDir: path.resolve(targetDir) });
  console.log(color.dim(`framework command: ${displayCommand(command, args)}`));
  runCommand(command, args, path.dirname(path.resolve(targetDir)), dryRun);
};

module.exports = {
  frameworkCommand,
  runFramework,
};
