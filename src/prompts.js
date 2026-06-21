'use strict';

const path = require('node:path');

const { nodeChoices } = require('./config');
const {
  detectGit,
  detectNodeMajor,
  detectPackageManager,
  fileExists,
  listGitRemotes,
  npmLatest,
  npmRecentMajorVersions,
  readJsonFile,
} = require('./detect');
const { color, createPrompter, promptChoice, promptText, promptYesNo } = require('./ui');

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

const latestFrameworkVersion = ({ config, framework }) => {
  const meta = config.frameworks[framework];
  if (!meta) {
    return null;
  }
  return npmLatest(meta.latestPackage);
};

const recentFrameworkMajorVersions = ({ config, framework }) => {
  const meta = config.frameworks[framework];
  if (!meta) {
    return [];
  }
  return npmRecentMajorVersions(meta.latestPackage, 4);
};

const resolveFrameworkVersion = async ({ rl, opts, config, framework, interactive }) => {
  const latest = latestFrameworkVersion({ config, framework });
  const label = config.frameworks[framework].label;

  if (latest) {
    console.log('');
    console.log(color.dim(`${label} latest: ${latest}`));
  } else if (interactive) {
    console.log('');
    console.log(color.yellow(`Could not check latest ${framework} version; using latest.`));
  }

  if (opts.frameworkVersion != null) {
    return opts.frameworkVersion;
  }

  if (!rl) {
    return latest || 'latest';
  }

  const selected = await promptChoice(
    rl,
    'Framework version?',
    [
      { label: latest ? `latest (${latest})` : 'latest', value: latest || 'latest' },
      { label: 'latest tag', value: 'latest' },
      { label: 'custom version', value: 'custom' },
    ],
    latest || 'latest',
  );
  if (selected !== 'custom') {
    return selected;
  }

  const recent = recentFrameworkMajorVersions({ config, framework });
  if (recent.length > 0) {
    console.log('');
    console.log(color.dim(`${label} recent exact versions:`));
    for (const { major, version } of recent) {
      console.log(color.dim(`  ${major}.x: ${version}`));
    }
  } else {
    console.log('');
    console.log(color.yellow(`Could not check recent ${framework} versions.`));
  }

  return promptText(rl, 'Custom framework version', latest || 'latest', (value) =>
    value ? true : 'Framework version is required.',
  );
};

const validatePort = (value) => {
  const port = Number(value);
  return Number.isInteger(port) && port > 0 && port <= 65535
    ? true
    : 'Enter a port from 1 to 65535.';
};

const describeExistingTsMode = async (targetDir) => {
  const tsconfigPath = path.join(targetDir, 'tsconfig.json');
  if (!(await fileExists(tsconfigPath))) {
    return 'no tsconfig';
  }
  try {
    const tsconfig = await readJsonFile(tsconfigPath);
    const strict = tsconfig.compilerOptions?.strict;
    if (strict === true) {
      return 'strict';
    }
    if (strict === false) {
      return 'non-strict';
    }
    return 'custom/default';
  } catch {
    return 'unreadable tsconfig';
  }
};

const tsModeChoices = (hasTsconfig, existingTsMode) =>
  hasTsconfig
    ? [
        { label: `preserve existing (${existingTsMode})`, value: 'preserve' },
        { label: 'strict', value: 'strict' },
        { label: 'non-strict', value: 'non-strict' },
      ]
    : [
        { label: 'strict', value: 'strict' },
        { label: 'non-strict', value: 'non-strict' },
      ];

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

const resolveGitAnswers = async ({ rl, opts, targetDir }) => {
  const git = detectGit(targetDir);
  const validModes = ['auto', 'skip', 'keep', 'init', 'replace'];
  let gitMode = opts.gitMode ?? 'auto';
  const remoteRequested = Boolean(opts.gitRemote || opts.gitRemoteRequested);
  const gitRequested = remoteRequested || opts.gitAdd === true;
  if (!validModes.includes(gitMode)) {
    throw new Error(`Unknown git mode: ${gitMode}`);
  }

  if (gitMode === 'auto') {
    if (gitRequested) {
      gitMode = git.inside ? 'keep' : 'init';
    } else if (!rl) {
      gitMode = git.inside ? 'keep' : 'skip';
    } else if (git.hasOwnGit) {
      gitMode = await promptChoice(
        rl,
        'Git repository?',
        [
          { label: 'keep existing repo', value: 'keep' },
          { label: 'replace with a fresh repo', value: 'replace' },
          { label: 'skip git changes', value: 'skip' },
        ],
        'skip',
      );
    } else if (git.inside) {
      gitMode = await promptChoice(
        rl,
        `Git repository? ${color.dim(`currently inside ${git.root}`)}`,
        [
          { label: 'keep parent/existing repo', value: 'keep' },
          { label: 'init nested repo here', value: 'init' },
          { label: 'skip git changes', value: 'skip' },
        ],
        'skip',
      );
    } else {
      gitMode = (await promptYesNo(rl, 'Initialize git repo?', false)) ? 'init' : 'skip';
    }
  }

  const canRemote = gitMode !== 'skip';
  let gitRemote = opts.gitRemote ?? null;
  const gitRemoteName = opts.gitRemoteName || 'origin';
  if (canRemote && !gitRemote && rl) {
    const remotes = git.inside ? listGitRemotes(targetDir) : [];
    const configure = remoteRequested
      ? true
      : await promptYesNo(
          rl,
          remotes.length > 0
            ? `Configure git remote? ${color.dim(`existing: ${remotes.join(', ')}`)}`
            : 'Configure git remote?',
          false,
        );
    if (configure) {
      gitRemote = await promptText(rl, `Remote URL for ${gitRemoteName}`, '', (value) =>
        value ? true : 'Remote URL is required.',
      );
    }
  }

  const gitAdd = opts.gitAdd ?? canRemote;

  return {
    gitAdd,
    gitMode,
    gitRemote,
    gitRemoteName,
  };
};

const resolveAnswers = async ({ opts: rawOpts, targetDir, existingPackage, config }) => {
  const interactive = isInteractive(rawOpts);
  const opts = inferDependentOptions(rawOpts, { interactive });
  const rl = interactive ? createPrompter() : null;

  try {
    const hasPackage = Boolean(existingPackage);
    const hasFlake = await fileExists(path.join(targetDir, 'flake.nix'));
    const hasEnvrc = await fileExists(path.join(targetDir, '.envrc'));
    const hasTsconfig = await fileExists(path.join(targetDir, 'tsconfig.json'));
    const detectedManager = await detectPackageManager(targetDir, existingPackage, config);
    const detectedNodeMajor = detectNodeMajor(existingPackage, config);
    const existingTsMode = await describeExistingTsMode(targetDir);

    const answers = {
      backup: opts.backup,
      dryRun: opts.dryRun,
      force: opts.force,
    };

    answers.nix = opts.nix ?? (hasFlake ? true : await boolChoice(rl, opts, 'nix', 'Use nix flake?', false));
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
      : await boolChoice(rl, opts, 'nodeProject', 'Node project?', false));

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

      answers.prettier = await boolChoice(rl, opts, 'prettier', 'Prettier?', false);

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

      answers.typescript = await boolChoice(rl, opts, 'typescript', 'TypeScript?', false);
      answers.tsMode = answers.typescript
        ? await valueChoice(
            rl,
            opts,
            'tsMode',
            'TypeScript strictness?',
            tsModeChoices(hasTsconfig, existingTsMode),
            hasTsconfig ? 'preserve' : 'non-strict',
          )
        : 'preserve';

      if (answers.framework === 'none') {
        const librariesRequested = Boolean(opts.devServer || opts.react || opts.tailwind || opts.vite || opts.vue);
        const libraries = librariesRequested
          ? true
          : await boolChoice(rl, opts, 'libraries', 'Libraries?', false);
        answers.vite = libraries ? await boolChoice(rl, opts, 'vite', 'Vite?', false) : false;
        answers.devServer = answers.vite
          ? await boolChoice(rl, opts, 'devServer', 'Dev server script?', false)
          : false;
        answers.devPort = answers.devServer
          ? Number(
              opts.devPort ??
                (rl ? await promptText(rl, 'Dev server port?', '3000', validatePort) : '3000'),
            )
          : 3000;
        answers.react = libraries ? await boolChoice(rl, opts, 'react', 'React?', false) : false;
        answers.vue = libraries && !answers.react
          ? await boolChoice(rl, opts, 'vue', 'Vue?', false)
          : false;
        answers.tailwind = answers.vite || answers.react || answers.vue
          ? await boolChoice(rl, opts, 'tailwind', 'Tailwind?', false)
          : Boolean(opts.tailwind);
        answers.vitest = await boolChoice(rl, opts, 'vitest', 'Vitest?', false);
      } else {
        answers.vite = false;
        answers.devServer = false;
        answers.devPort = 3000;
        answers.vitest = false;
        answers.react = answers.framework === 'next';
        answers.vue = answers.framework === 'nuxt';
        answers.tailwind = await boolChoice(rl, opts, 'tailwind', 'Tailwind?', false);
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
