'use strict';

const path = require('node:path');

const { nodeChoices } = require('./config');
const {
  detectNodeMajor,
  detectPackageManager,
  fileExists,
} = require('./detect');
const { featureSet, resolveTypescriptAnswers } = require('./prompt-features');
const { resolveFrameworkVersion } = require('./prompt-frameworks');
const { resolveGitAnswers } = require('./prompt-git');
const { createPrompter, promptChoice, promptText, promptYesNo } = require('./ui');

const isInteractive = (opts) => process.stdin.isTTY && process.stdout.isTTY && !opts.yes;

const boolChoice = async (rl, opts, key, message, defaultValue) => {
  if (opts[key] != null) {
    return opts[key];
  }
  if (!rl) {
    return defaultValue;
  }
  return promptYesNo(rl, message, defaultValue);
};

const preferredChoiceDefault = (choices, fallback) => {
  const preferred = choices.find((choice) =>
    /^(keep detected|preserve existing)\b/i.test(choice.label),
  );
  return preferred?.value ?? fallback;
};

const valueChoice = async (rl, opts, key, message, choices, defaultValue) => {
  if (opts[key] != null) {
    return opts[key];
  }
  const resolvedDefault = preferredChoiceDefault(choices, defaultValue);
  if (!rl) {
    return resolvedDefault;
  }
  return promptChoice(rl, message, choices, resolvedDefault);
};

const packageManagerChoices = (config, hasPackage, detectedManager) => {
  const choices = Object.keys(config.packageManagers).map((manager) => ({
    label: manager === 'yarn' ? 'yarn classic' : manager,
    value: manager,
  }));
  if (hasPackage && detectedManager) {
    choices.push({ label: `keep detected ${detectedManager}`, value: 'keep' });
  }
  return choices;
};

const validatePort = (value) => {
  const port = Number(value);
  return Number.isInteger(port) && port > 0 && port <= 65535
    ? true
    : 'Enter a port from 1 to 65535.';
};

const inferDependentOptions = (opts, { interactive }) => {
  const inferred = { ...opts };

  const requireNix = (flag) => {
    if (opts.nix === false) {
      throw new Error(`${flag} requires --nix`);
    }
    inferred.nix = true;
  };

  const requireNodeProject = (flag) => {
    if (opts.nodeProject === false) {
      throw new Error(`${flag} requires --node-project`);
    }
    inferred.nodeProject = true;
  };

  if (opts.direnv === true) {
    requireNix('--direnv');
  }
  if (opts.flakeLock === true) {
    requireNix('--flake-lock');
  }

  const frameworkOptionSet = opts.framework != null;
  const frameworkRequested = frameworkOptionSet && opts.framework !== 'none';
  const nodeRequests = [
    [frameworkOptionSet, '--framework'],
    [opts.frameworkVersion != null, '--framework-version'],
    [opts.nodeMajor != null, '--node'],
    [opts.packageManager != null, '--package-manager'],
    [opts.prettier === true, '--prettier'],
    [opts.tailwind === true, '--tailwind'],
    [opts.typescript === true, '--typescript'],
    [opts.tsMode != null, '--strict/--non-strict/--preserve-ts'],
    [opts.vite === true, '--vite'],
    [opts.devServer === true, '--dev-server'],
    [opts.devPort != null, '--dev-port'],
    [opts.vitest === true, '--vitest'],
    [opts.react === true, '--react'],
    [opts.vue === true, '--vue'],
    [opts.install === true, '--install'],
  ];
  const nodeRequest = nodeRequests.find(([enabled]) => enabled);
  if (nodeRequest) {
    requireNodeProject(nodeRequest[1]);
  }

  if (opts.frameworkVersion != null && !frameworkRequested) {
    throw new Error('--framework-version requires --framework <next|nuxt>');
  }

  if (opts.tsMode != null) {
    if (opts.typescript === false) {
      throw new Error('--strict/--non-strict/--preserve-ts requires --typescript');
    }
    inferred.typescript = true;
  }

  if (opts.devServer === true || opts.devPort != null) {
    if (opts.vite === false) {
      throw new Error('--dev-server/--dev-port requires --vite');
    }
    inferred.vite = true;
    inferred.devServer = true;
  }

  if (opts.libraries === false) {
    const libraryFlags = [
      [opts.devServer === true, '--dev-server'],
      [opts.devPort != null, '--dev-port'],
      [opts.react === true, '--react'],
      [opts.tailwind === true, '--tailwind'],
      [opts.vite === true, '--vite'],
      [opts.vue === true, '--vue'],
    ];
    const requested = libraryFlags.find(([enabled]) => enabled);
    if (requested) {
      throw new Error(`${requested[1]} cannot be used with --no-libraries`);
    }
  }

  if (opts.licenseType != null) {
    if (opts.license === false) {
      throw new Error('--license-type requires --license');
    }
    inferred.license = true;
  }

  if (opts.gitRemoteNameProvided && !opts.gitRemote) {
    if (opts.gitMode === 'skip') {
      throw new Error('--git-remote-name cannot be used with --git skip');
    }
    if (!interactive) {
      throw new Error('--git-remote-name requires --git-remote when prompts are disabled');
    }
    inferred.gitRemoteRequested = true;
  }
  if (opts.gitRemote && opts.gitMode === 'skip') {
    throw new Error('--git-remote cannot be used with --git skip');
  }
  if (opts.gitAdd === true && opts.gitMode === 'skip') {
    throw new Error('--git-add cannot be used with --git skip');
  }

  return inferred;
};

const resolveAnswers = async ({ opts: rawOpts, targetDir, existingPackage, config }) => {
  const interactive = isInteractive(rawOpts);
  const opts = inferDependentOptions(rawOpts, { interactive });
  const rl = interactive ? createPrompter() : null;

  try {
    const hasPackage = Boolean(existingPackage);
    const hasFlake = await fileExists(path.join(targetDir, 'flake.nix'));
    const hasEnvrc = await fileExists(path.join(targetDir, '.envrc'));
    const detectedManager = await detectPackageManager(targetDir, existingPackage, config);
    const detectedNodeMajor = detectNodeMajor(existingPackage, config);

    const answers = {
      backup: opts.backup,
      dryRun: opts.dryRun,
      force: opts.force,
    };

    answers.nix = opts.nix ?? (hasFlake ? true : await boolChoice(rl, opts, 'nix', 'Use nix flake?', true));
    answers.direnv = opts.direnv ?? (answers.nix
      ? hasEnvrc || await boolChoice(rl, opts, 'direnv', 'Use direnv?', true)
      : false);
    if (!answers.nix && opts.direnv) {
      throw new Error('--direnv requires --nix because the managed .envrc uses "use flake"');
    }

    const frameworkRequested = opts.framework && opts.framework !== 'none';
    const nodeProjectRequested = Boolean(
      frameworkRequested ||
        opts.devServer ||
        opts.install ||
        opts.nodeMajor ||
        opts.packageManager ||
        opts.prettier ||
        opts.react ||
        opts.typescript ||
        opts.vite ||
        opts.vitest ||
        opts.vue,
    );
    answers.nodeProject = opts.nodeProject ?? (hasPackage || nodeProjectRequested
      ? true
      : await boolChoice(rl, opts, 'nodeProject', 'Node project?', true));

    if (answers.nodeProject) {
      answers.nodeMajor = await valueChoice(
        rl,
        opts,
        'nodeMajor',
        'Node version?',
        nodeChoices(config),
        detectedNodeMajor || '24',
      );
      if (!config.nodeTargets[answers.nodeMajor]) {
        throw new Error(`Unsupported Node version: ${answers.nodeMajor}`);
      }

      answers.packageManager = await valueChoice(
        rl,
        opts,
        'packageManager',
        'Package manager?',
        packageManagerChoices(config, hasPackage, detectedManager),
        'pnpm',
      );
      if (
        answers.packageManager !== 'keep' &&
        !Object.prototype.hasOwnProperty.call(config.packageManagers, answers.packageManager)
      ) {
        throw new Error(`Unknown package manager: ${answers.packageManager}`);
      }
      if (answers.packageManager === 'keep' && !detectedManager) {
        throw new Error('Cannot keep package manager because none was detected');
      }
      answers.toolchainManager =
        answers.packageManager === 'keep' ? detectedManager || 'pnpm' : answers.packageManager;

      Object.assign(answers, await resolveTypescriptAnswers(rl, opts));

      answers.framework =
        hasPackage && opts.framework == null
          ? 'none'
          : await valueChoice(
              rl,
              opts,
              'framework',
              'Framework?',
              [
                { label: 'none', value: 'none' },
                { label: 'Next.js', value: 'next' },
                { label: 'Nuxt', value: 'nuxt' },
              ],
              'none',
            );
      if (answers.framework !== 'none' && !config.frameworks[answers.framework]) {
        throw new Error(`Unknown framework: ${answers.framework}`);
      }

      if (answers.framework !== 'none') {
        answers.frameworkVersion = await resolveFrameworkVersion({
          rl,
          opts,
          config,
          framework: answers.framework,
          interactive,
        });
      } else {
        answers.frameworkVersion = null;
      }

      if (answers.framework === 'none') {
        const libraryChoices = opts.libraries === false
          ? []
          : [
              { key: 'vite', label: 'Vite', hint: 'dev server and production build' },
              { key: 'react', label: 'React starter' },
              { key: 'vue', label: 'Vue starter' },
              { key: 'tailwind', label: 'Tailwind CSS', hint: 'local Vite setup' },
            ];
        const selectedFeatures = await featureSet(rl, opts, 'Select features to include:', [
          { key: 'prettier', label: 'Prettier', hint: 'code formatting', defaultValue: true },
          ...libraryChoices,
          { key: 'vitest', label: 'Vitest', hint: 'unit testing' },
        ]);
        answers.prettier = selectedFeatures.prettier;
        answers.vite = Boolean(selectedFeatures.vite);
        answers.react = Boolean(selectedFeatures.react);
        answers.vue = Boolean(selectedFeatures.vue);
        answers.tailwind = Boolean(selectedFeatures.tailwind);
        answers.vitest = Boolean(selectedFeatures.vitest);

        if (answers.devServer) {
          answers.vite = true;
        }
        if (answers.tailwind) {
          if (opts.vite === false) {
            throw new Error('--tailwind requires --vite for local starters');
          }
          answers.vite = true;
        }
        if (answers.vue && answers.react && rl) {
          const starter = await promptChoice(
            rl,
            'Frontend starter?',
            [
              { label: 'React', value: 'react' },
              { label: 'Vue', value: 'vue' },
            ],
            'react',
          );
          answers.react = starter === 'react';
          answers.vue = starter === 'vue';
        }
        answers.devServer = opts.devServer ?? answers.vite;
        answers.devPort = answers.devServer
          ? Number(
              opts.devPort ??
                (rl ? await promptText(rl, 'Dev server port?', '3000', validatePort) : '3000'),
            )
          : 3000;
      } else {
        const selectedFeatures = await featureSet(rl, opts, 'Select features to include:', [
          { key: 'prettier', label: 'Prettier', hint: 'code formatting', defaultValue: true },
          { key: 'tailwind', label: 'Tailwind CSS' },
        ]);
        answers.prettier = selectedFeatures.prettier;
        answers.vite = false;
        answers.devServer = false;
        answers.devPort = 3000;
        answers.vitest = false;
        answers.react = answers.framework === 'next';
        answers.vue = answers.framework === 'nuxt';
        answers.tailwind = selectedFeatures.tailwind;
      }
    } else {
      Object.assign(answers, {
        devPort: 3000,
        devServer: false,
        framework: 'none',
        frameworkVersion: null,
        nodeMajor: detectedNodeMajor || '24',
        packageManager: detectedManager || 'pnpm',
        prettier: false,
        react: false,
        tailwind: false,
        toolchainManager: detectedManager || 'pnpm',
        tsMode: 'preserve',
        typescript: false,
        vite: false,
        vitest: false,
        vue: false,
      });
    }

    answers.license = await boolChoice(rl, opts, 'license', 'License?', false);
    answers.licenseType = answers.license
      ? await valueChoice(
          rl,
          opts,
          'licenseType',
          'License type?',
          Object.entries(config.licenseTypes).map(([value, license]) => ({
            label: license.label,
            value,
          })),
          config.defaultLicense,
        )
      : opts.licenseType || null;

    answers.agents = await boolChoice(rl, opts, 'agents', 'AGENTS.md?', false);

    answers.flakeLock = answers.nix
      ? await boolChoice(rl, opts, 'flakeLock', 'Run nix flake lock after writing files?', true)
      : false;
    answers.install = answers.nodeProject
      ? await boolChoice(
          rl,
          opts,
          'install',
          `Run ${answers.toolchainManager} install after writing files?`,
          false,
        )
      : false;

    Object.assign(answers, await resolveGitAnswers({ rl, opts, targetDir }));

    if (answers.vue && answers.react) {
      throw new Error('React and Vue starters are mutually exclusive');
    }
    if (answers.framework !== 'none' && (opts.vite || opts.vitest)) {
      throw new Error('--vite/--vitest cannot be combined with --framework');
    }
    if (opts.devPort && validatePort(opts.devPort) !== true) {
      throw new Error(`Invalid --dev-port: ${opts.devPort}`);
    }

    return answers;
  } finally {
    rl?.close();
  }
};

module.exports = {
  isInteractive,
  resolveAnswers,
};
