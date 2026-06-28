'use strict';

const path = require('node:path');

const { nodeChoices } = require('./config');
const {
  FOUNDATION_CHOICES,
  OWNED_FOUNDATION,
  isAppSeed,
  isNextFoundation,
  isNuxtFoundation,
  isOwnedFoundation,
  isReactFoundation,
  isSeededFoundation,
  isViteSeed,
  isVueFoundation,
} = require('./foundations');
const {
  detectNodeMajor,
  detectPackageManager,
  fileExists,
} = require('./detect');
const { featureSet, resolveTypescriptAnswers } = require('./prompt-features');
const { resolveSeedVersion } = require('./prompt-foundations');
const {
  resolveGitAdd,
  resolveCommitOverrides,
  resolveGitMode,
  resolveGitPush,
  resolveGitRemote,
  resolveGitRemoteConfigure,
} = require('./prompt-git');
const { createPrompter, isPromptBack, promptChoice, promptText, promptYesNo } = require('./ui');
const { clearRendered } = require('./ui/frame');

const isInteractive = (opts) => process.stdin.isTTY && process.stdout.isTTY && !opts.yes;

const selectedFeatureConflict = (featureValues, conflicts = []) => {
  for (const conflict of conflicts) {
    if (
      conflict.foundations &&
      !conflict.foundations.includes(featureValues.foundation)
    ) {
      continue;
    }
    const featureMatch =
      !conflict.features || conflict.features.every((feature) => Boolean(featureValues[feature]));
    const whenMatch =
      !conflict.when ||
      Object.entries(conflict.when).every(([feature, value]) => Boolean(featureValues[feature]) === value);
    if (featureMatch && whenMatch) {
      return conflict.message;
    }
  }
  return null;
};

const boolChoice = async (rl, opts, key, message, defaultValue) => {
  if (opts[key] != null) {
    return opts[key];
  }
  if (rl && opts._rememberedAnswers && opts._rememberedAnswers[key] != null) {
    return promptYesNo(rl, message, opts._rememberedAnswers[key]);
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
  const remembered = opts._rememberedAnswers?.[key];
  const rememberedValid = choices.some((choice) => choice.value === remembered);
  const resolvedDefault = rememberedValid ? remembered : preferredChoiceDefault(choices, defaultValue);
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

const nuxtOptionFlags = (opts) => [
  [opts.nuxtOffline === true, '--nuxt-offline'],
  [opts.nuxtPreferOffline === true, '--nuxt-prefer-offline'],
];

const findNuxtOptionFlag = (opts) => nuxtOptionFlags(opts).find(([enabled]) => enabled);

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

  const foundationOptionSet = opts.foundation != null;
  const seededFoundationRequested = foundationOptionSet && isSeededFoundation(opts.foundation);
  const nuxtOptionFlag = findNuxtOptionFlag(opts);
  const nodeRequests = [
    [foundationOptionSet, '--foundation'],
    [opts.seedVersion != null, '--seed-version'],
    [Boolean(nuxtOptionFlag), nuxtOptionFlag?.[1]],
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
    [opts.jsx === true, '--jsx'],
    [opts.router === true, '--router'],
    [opts.pinia === true, '--pinia'],
    [opts.eslint === true, '--eslint'],
    [opts.install === true, '--install'],
    [opts.pnpmApproveBuilds === true, '--pnpm-approve-builds'],
  ];
  const nodeRequest = nodeRequests.find(([enabled]) => enabled);
  if (nodeRequest) {
    requireNodeProject(nodeRequest[1]);
  }

  if (foundationOptionSet && !isOwnedFoundation(opts.foundation) && !isSeededFoundation(opts.foundation)) {
    throw new Error(`Unknown foundation: ${opts.foundation}`);
  }
  if (opts.seedVersion != null && !seededFoundationRequested) {
    throw new Error('--seed-version requires --foundation <next|nuxt|react-vite|vue-vite>');
  }
  if (nuxtOptionFlag && opts.foundation !== 'nuxt') {
    throw new Error(`${nuxtOptionFlag[1]} requires --foundation nuxt`);
  }
  if (opts.nuxtOffline && opts.nuxtPreferOffline) {
    throw new Error('--nuxt-offline cannot be combined with --nuxt-prefer-offline');
  }
  if (isViteSeed(opts.foundation) && opts.vite === false) {
    throw new Error('--foundation react-vite/vue-vite cannot be combined with --no-vite');
  }
  if (isReactFoundation(opts.foundation) && opts.react === false) {
    throw new Error(`--foundation ${opts.foundation} cannot be combined with --no-react`);
  }
  if (isVueFoundation(opts.foundation) && opts.vue === false) {
    throw new Error(`--foundation ${opts.foundation} cannot be combined with --no-vue`);
  }
  if (isReactFoundation(opts.foundation) && opts.vue === true) {
    throw new Error(`--foundation ${opts.foundation} cannot be combined with --vue`);
  }
  if (isVueFoundation(opts.foundation) && opts.react === true) {
    throw new Error(`--foundation ${opts.foundation} cannot be combined with --react`);
  }
  const vueBaseFlags = [
    [opts.jsx === true, '--jsx'],
    [opts.pinia === true, '--pinia'],
    [opts.eslint === true, '--eslint'],
  ];
  const vueBaseFlag = vueBaseFlags.find(([enabled]) => enabled);
  if (vueBaseFlag && opts.foundation !== 'vue-vite') {
    throw new Error(`${vueBaseFlag[1]} requires --foundation vue-vite`);
  }
  if (opts.router === true && !['react-vite', 'vue-vite'].includes(opts.foundation)) {
    throw new Error('--router requires --foundation react-vite or --foundation vue-vite');
  }

  if (opts.tsMode != null) {
    if (opts.typescript === false) {
      throw new Error('--strict/--non-strict/--preserve-ts requires --typescript');
    }
    inferred.typescript = true;
  }
  if (opts.jsonplaceholderTypes === true) {
    if (opts.typescript === false) {
      throw new Error('--jsonplaceholder-types requires --typescript');
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

  if (opts.featurePrompts === false) {
    const featureFlags = [
      [opts.devServer === true, '--dev-server'],
      [opts.devPort != null, '--dev-port'],
      [opts.react === true, '--react'],
      [opts.tailwind === true, '--tailwind'],
      [opts.vite === true, '--vite'],
      [opts.vue === true, '--vue'],
      [opts.jsonplaceholderTypes === true, '--jsonplaceholder-types'],
      [seededFoundationRequested, '--foundation'],
      [opts.jsx === true, '--jsx'],
      [opts.router === true, '--router'],
      [opts.pinia === true, '--pinia'],
      [opts.eslint === true, '--eslint'],
    ];
    const requested = featureFlags.find(([enabled]) => enabled);
    if (requested) {
      throw new Error(`${requested[1]} cannot be used with --no-feature-prompts`);
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
  if (opts.commitOverrides === true && opts.gitMode === 'skip') {
    throw new Error('--commit-overrides cannot be used with --git skip');
  }
  if (opts.gitPush === true) {
    if (opts.gitMode === 'skip') {
      throw new Error('--git-push cannot be used with --git skip');
    }
    if (!opts.gitRemote && !interactive) {
      throw new Error('--git-push requires --git-remote when prompts are disabled');
    }
    inferred.gitRemoteRequested = true;
  }

  return inferred;
};

const deleteStepAnswers = (answers, steps, fromIndex) => {
  for (const step of steps.slice(fromIndex)) {
    for (const key of step.keys) {
      delete answers[key];
    }
  }
};

const previousPromptStep = (steps, index) => {
  for (let previous = index - 1; previous >= 0; previous -= 1) {
    if (steps[previous].backStop) {
      return previous;
    }
  }
  return -1;
};

const resolveAnswers = async ({ opts: rawOpts, targetDir, mode, existingPackage, config }) => {
  const interactive = isInteractive(rawOpts);
  const opts = inferDependentOptions(rawOpts, { interactive });
  const rememberedAnswers = {};
  opts._rememberedAnswers = rememberedAnswers;
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

    const seededFoundationRequested = opts.foundation && isSeededFoundation(opts.foundation);
    const nuxtOptionFlag = findNuxtOptionFlag(opts);
    const nodeProjectRequested = Boolean(
      seededFoundationRequested ||
        opts.devServer ||
        opts.install ||
        opts.nodeMajor ||
        opts.packageManager ||
        opts.prettier ||
        opts.react ||
        opts.typescript ||
        opts.jsonplaceholderTypes ||
        opts.vite ||
        opts.vitest ||
        opts.vue ||
        opts.jsx ||
        opts.router ||
        opts.pinia ||
        opts.eslint ||
        opts.pnpmApproveBuilds ||
        Boolean(nuxtOptionFlag),
    );

    const buildSteps = () => {
      const steps = [
        {
          keys: ['nix'],
          backStop: Boolean(rl && opts.nix == null && !hasFlake),
          run: async () => ({
            nix: opts.nix ?? (hasFlake ? true : await boolChoice(rl, opts, 'nix', 'Use nix flake?', true)),
          }),
        },
        {
          keys: ['direnv'],
          backStop: Boolean(rl && opts.direnv == null && answers.nix && !hasEnvrc),
          run: async () => ({
            direnv: opts.direnv ?? (answers.nix
              ? hasEnvrc || await boolChoice(rl, opts, 'direnv', 'Use direnv?', true)
              : false),
          }),
        },
        {
          keys: ['nodeProject'],
          backStop: Boolean(rl && opts.nodeProject == null && !hasPackage && !nodeProjectRequested),
          run: async () => ({
            nodeProject: opts.nodeProject ?? (hasPackage || nodeProjectRequested
              ? true
              : await boolChoice(rl, opts, 'nodeProject', 'Node project?', true)),
          }),
        },
      ];

      if (answers.nodeProject) {
        steps.push(
          {
            keys: ['nodeMajor'],
            backStop: Boolean(rl && opts.nodeMajor == null),
            run: async () => {
              const nodeMajor = await valueChoice(
                rl,
                opts,
                'nodeMajor',
                'Node version?',
                nodeChoices(config),
                detectedNodeMajor || '24',
              );
              if (!config.nodeTargets[nodeMajor]) {
                throw new Error(`Unsupported Node version: ${nodeMajor}`);
              }
              return { nodeMajor };
            },
          },
          {
            keys: ['packageManager', 'toolchainManager'],
            backStop: Boolean(rl && opts.packageManager == null),
            run: async () => {
              const packageManager = await valueChoice(
                rl,
                opts,
                'packageManager',
                'Package manager?',
                packageManagerChoices(config, hasPackage, detectedManager),
                'pnpm',
              );
              if (
                packageManager !== 'keep' &&
                !Object.prototype.hasOwnProperty.call(config.packageManagers, packageManager)
              ) {
                throw new Error(`Unknown package manager: ${packageManager}`);
              }
              if (packageManager === 'keep' && !detectedManager) {
                throw new Error('Cannot keep package manager because none was detected');
              }
              return {
                packageManager,
                toolchainManager: packageManager === 'keep' ? detectedManager || 'pnpm' : packageManager,
              };
            },
          },
          {
            keys: ['typescript', 'tsMode'],
            backStop: Boolean(rl && opts.typescript !== false && opts.tsMode == null),
            run: () => resolveTypescriptAnswers(rl, opts),
          },
          {
            keys: ['foundation', 'seedVersion'],
            backStop: Boolean(rl && !(hasPackage && opts.foundation == null) && opts.foundation == null),
            run: async () => {
              const foundation =
                hasPackage && opts.foundation == null
                  ? OWNED_FOUNDATION
                  : await valueChoice(
                      rl,
                      opts,
                      'foundation',
                      'Template?',
                      FOUNDATION_CHOICES,
                      OWNED_FOUNDATION,
                    );
              if (!isOwnedFoundation(foundation) && !isSeededFoundation(foundation)) {
                throw new Error(`Unknown foundation: ${foundation}`);
              }
              return { foundation, seedVersion: null };
            },
          },
        );

        if (isSeededFoundation(answers.foundation)) {
          steps.push({
            keys: ['seedVersion'],
            backStop: Boolean(rl && opts.seedVersion == null),
            run: async () => ({
              seedVersion: await resolveSeedVersion({
                rl,
                opts,
                config,
                foundation: answers.foundation,
                interactive,
              }),
            }),
          });
        }

        if (isOwnedFoundation(answers.foundation) || isViteSeed(answers.foundation)) {
          steps.push(
            {
              keys: [
                'prettier',
                'vite',
                'react',
                'vue',
                'tailwind',
                'vitest',
                'jsonplaceholderTypes',
                'jsx',
                'router',
                'pinia',
                'eslint',
              ],
              backStop: Boolean(
                rl &&
                  [
                    opts.prettier,
                    opts.vite,
                    opts.react,
                    opts.vue,
                    opts.tailwind,
                    opts.vitest,
                    opts.jsonplaceholderTypes,
                    opts.jsx,
                    opts.router,
                    opts.pinia,
                    opts.eslint,
                  ].some((value) => value == null),
              ),
              run: async () => {
                const seededReact = answers.foundation === 'react-vite';
                const seededVue = answers.foundation === 'vue-vite';
                const owned = isOwnedFoundation(answers.foundation);
                const bareChoices = opts.featurePrompts === false || !owned
                  ? []
                  : [
                      { key: 'vite', label: 'Vite', hint: 'dev server and production build' },
                      { key: 'react', label: 'React', hint: 'minimal' },
                      { key: 'vue', label: 'Vue', hint: 'minimal' },
                    ];
                const featureChoices = opts.featurePrompts === false
                  ? []
                  : [
                      ...bareChoices,
                      { key: 'tailwind', label: 'Tailwind CSS', hint: 'Vite setup' },
                    ];
                const vueSeedChoices = seededVue
                  ? [
                      { key: 'jsx', label: 'JSX support', hint: 'create-vue' },
                      { key: 'router', label: 'Vue Router', hint: 'create-vue' },
                      { key: 'pinia', label: 'Pinia', hint: 'create-vue' },
                      { key: 'eslint', label: 'Linter', hint: 'ESLint via create-vue' },
                    ]
                  : [];
                const reactSeedChoices = seededReact
                  ? [{ key: 'router', label: 'React Router', hint: 'post-create-vite' }]
                  : [];
                const selectedFeatures = await featureSet(
                  rl,
                  opts,
                  'Select features to include:',
                  [
                    { key: 'prettier', label: 'Prettier', hint: 'code formatting', defaultValue: true },
                    ...featureChoices,
                    ...reactSeedChoices,
                    ...vueSeedChoices,
                    ...(answers.typescript
                      ? [{ key: 'jsonplaceholderTypes', label: 'JSONPlaceholder types', hint: 'data.ts' }]
                      : []),
                    { key: 'vitest', label: 'Vitest', hint: 'unit testing' },
                  ],
                  {
                    validate: (selected) =>
                      selectedFeatureConflict({ ...answers, ...opts, ...selected }, config.featureConflicts) ||
                      true,
                  },
                );
                const tailwind = Boolean(selectedFeatures.tailwind);
                return {
                  prettier: selectedFeatures.prettier,
                  vite: seededReact || seededVue || Boolean(selectedFeatures.vite),
                  react: seededReact || Boolean(selectedFeatures.react),
                  vue: seededVue || Boolean(selectedFeatures.vue),
                  tailwind,
                  vitest: Boolean(selectedFeatures.vitest),
                  jsonplaceholderTypes: answers.typescript && Boolean(selectedFeatures.jsonplaceholderTypes),
                  jsx: seededVue && Boolean(selectedFeatures.jsx),
                  router: (seededReact || seededVue) && Boolean(selectedFeatures.router),
                  pinia: seededVue && Boolean(selectedFeatures.pinia),
                  eslint: seededVue && Boolean(selectedFeatures.eslint),
                };
              },
            },
            {
              keys: ['devServer', 'devPort'],
              backStop: Boolean(rl && (opts.devServer ?? answers.vite) && opts.devPort == null),
              run: async () => {
                const devServer = opts.devServer ?? answers.vite;
                return {
                  devServer,
                  devPort: devServer
                    ? Number(
                        opts.devPort ??
                          (rl
                            ? await promptText(
                                rl,
                                'Dev server port?',
                                String(opts._rememberedAnswers?.devPort ?? '3000'),
                                validatePort,
                              )
                            : '3000'),
                      )
                    : 3000,
                };
              },
            },
          );
        } else if (isAppSeed(answers.foundation)) {
          steps.push({
            keys: [
              'prettier',
              'vite',
              'devServer',
              'devPort',
              'vitest',
              'jsonplaceholderTypes',
              'react',
              'vue',
              'tailwind',
              'nuxtOffline',
              'nuxtPreferOffline',
            ],
            backStop: Boolean(
              rl &&
                [
                  opts.prettier,
                  opts.tailwind,
                  opts.vitest,
                  opts.jsonplaceholderTypes,
                  isNuxtFoundation(answers.foundation) ? opts.nuxtOffline : false,
                  isNuxtFoundation(answers.foundation) ? opts.nuxtPreferOffline : false,
                ].some((value) => value == null),
            ),
            run: async () => {
              const nuxt = isNuxtFoundation(answers.foundation);
              const selectedFeatures = await featureSet(rl, opts, 'Select features to include:', [
                { key: 'prettier', label: 'Prettier', hint: 'code formatting', defaultValue: true },
                { key: 'tailwind', label: 'Tailwind CSS' },
                ...(answers.typescript
                  ? [{ key: 'jsonplaceholderTypes', label: 'JSONPlaceholder types', hint: 'data.ts' }]
                  : []),
                { key: 'vitest', label: 'Vitest', hint: 'unit testing' },
                ...(nuxt
                  ? [
                      { key: 'nuxtOffline', label: 'Nuxt offline', hint: 'force offline mode' },
                      { key: 'nuxtPreferOffline', label: 'Nuxt prefer offline', hint: 'prefer cached templates' },
                    ]
                  : []),
              ]);
              if (selectedFeatures.nuxtOffline && selectedFeatures.nuxtPreferOffline) {
                throw new Error('Nuxt offline and prefer offline are mutually exclusive');
              }
              return {
                prettier: selectedFeatures.prettier,
                vite: false,
                devServer: false,
                devPort: 3000,
                vitest: Boolean(selectedFeatures.vitest),
                jsonplaceholderTypes: answers.typescript && Boolean(selectedFeatures.jsonplaceholderTypes),
                react: isNextFoundation(answers.foundation),
                vue: isNuxtFoundation(answers.foundation),
                tailwind: selectedFeatures.tailwind,
                nuxtOffline: nuxt && Boolean(selectedFeatures.nuxtOffline),
                nuxtPreferOffline: nuxt && Boolean(selectedFeatures.nuxtPreferOffline),
              };
            },
          });
        }
      } else if (answers.nodeProject === false) {
        steps.push({
          keys: [
            'devPort',
            'devServer',
            'foundation',
            'seedVersion',
            'jsx',
            'jsonplaceholderTypes',
            'router',
            'pinia',
            'eslint',
            'nodeMajor',
            'packageManager',
            'prettier',
            'react',
            'tailwind',
            'toolchainManager',
            'tsMode',
            'typescript',
            'vite',
            'vitest',
            'vue',
          ],
          backStop: false,
          run: async () => ({
            devPort: 3000,
            devServer: false,
            foundation: OWNED_FOUNDATION,
            seedVersion: null,
            jsx: false,
            jsonplaceholderTypes: false,
            router: false,
            pinia: false,
            eslint: false,
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
          }),
        });
      }

      steps.push(
        {
          keys: ['license'],
          backStop: Boolean(rl && opts.license == null),
          run: async () => ({ license: await boolChoice(rl, opts, 'license', 'License?', false) }),
        },
        {
          keys: ['licenseType'],
          backStop: Boolean(rl && answers.license && opts.licenseType == null),
          run: async () => ({
            licenseType: answers.license
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
              : opts.licenseType || null,
          }),
        },
        {
          keys: ['agents'],
          backStop: Boolean(rl && opts.agents == null),
          run: async () => ({ agents: await boolChoice(rl, opts, 'agents', 'AGENTS.md?', false) }),
        },
        {
          keys: ['flakeLock'],
          backStop: Boolean(rl && answers.nix && opts.flakeLock == null),
          run: async () => ({
            flakeLock: answers.nix
              ? await boolChoice(rl, opts, 'flakeLock', 'Run nix flake lock after writing files?', true)
              : false,
          }),
        },
        {
          keys: ['install'],
          backStop: Boolean(rl && answers.nodeProject && opts.install == null),
          run: async () => ({
            install: answers.nodeProject
              ? await boolChoice(
                  rl,
                  opts,
                  'install',
                  `Run ${answers.toolchainManager} install after writing files?`,
                  true,
                )
              : false,
          }),
        },
        {
          keys: ['pnpmApproveBuilds'],
          backStop: Boolean(
            rl &&
              answers.install &&
              answers.toolchainManager === 'pnpm' &&
              opts.pnpmApproveBuilds == null,
          ),
          run: async () => ({
            pnpmApproveBuilds:
              answers.install && answers.toolchainManager === 'pnpm'
                ? await boolChoice(
                    rl,
                    opts,
                    'pnpmApproveBuilds',
                    'Auto-approve pnpm ignored builds if install is blocked?',
                    true,
                  )
                : false,
          }),
        },
        {
          keys: ['gitMode'],
          backStop: Boolean(rl),
          run: () => resolveGitMode({ rl, opts, targetDir, mode }),
        },
        {
          keys: ['commitOverrides'],
          backStop: Boolean(rl && answers.gitMode !== 'skip'),
          run: () => resolveCommitOverrides({ rl, opts, gitMode: answers.gitMode }),
        },
        {
          keys: ['gitConfigureRemote', 'gitRemoteName'],
          backStop: Boolean(rl && answers.gitMode !== 'skip' && !opts.gitRemote),
          run: () => resolveGitRemoteConfigure({ rl, opts, targetDir, gitMode: answers.gitMode }),
        },
        {
          keys: ['gitRemote'],
          backStop: Boolean(
            rl && answers.gitMode !== 'skip' && answers.gitConfigureRemote && !opts.gitRemote,
          ),
          run: () =>
            resolveGitRemote({
              rl,
              opts,
              targetDir,
              gitMode: answers.gitMode,
              gitConfigureRemote: answers.gitConfigureRemote,
              gitRemoteName: answers.gitRemoteName,
            }),
        },
        {
          keys: ['gitPush'],
          backStop: Boolean(rl && answers.gitMode !== 'skip' && answers.gitRemote),
          run: () =>
            resolveGitPush({
              rl,
              opts,
              gitMode: answers.gitMode,
              gitRemote: answers.gitRemote,
            }),
        },
        {
          keys: ['gitAdd', 'gitRemoteName'],
          backStop: false,
          run: () => resolveGitAdd({ opts, gitMode: answers.gitMode }),
        },
      );

      return steps;
    };

    let index = 0;
    const stepStartLines = [];
    while (true) {
      const steps = buildSteps();
      if (index >= steps.length) {
        break;
      }

      try {
        stepStartLines[index] = rl?.renderedPromptLines || 0;
        const stepAnswers = await steps[index].run();
        Object.assign(answers, stepAnswers);
        Object.assign(rememberedAnswers, stepAnswers);
        index += 1;
      } catch (error) {
        if (!isPromptBack(error) || !rl) {
          throw error;
        }
        const previous = previousPromptStep(steps, index);
        const target = previous < 0 ? index : previous;
        const targetStartLines = stepStartLines[target] || 0;
        const linesToClear = (rl.renderedPromptLines || 0) - targetStartLines;
        if (linesToClear > 0 && rl.output?.isTTY) {
          clearRendered(rl.output, linesToClear);
        }
        rl.renderedPromptLines = targetStartLines;
        deleteStepAnswers(answers, steps, target);
        stepStartLines.length = target;
        index = target;
      }
    }

    if (!answers.nix && opts.direnv) {
      throw new Error('--direnv requires --nix because the managed .envrc uses "use flake"');
    }
    if (opts.pnpmApproveBuilds === true && !answers.install) {
      throw new Error('--pnpm-approve-builds requires --install');
    }
    if (opts.pnpmApproveBuilds === true && answers.toolchainManager !== 'pnpm') {
      throw new Error('--pnpm-approve-builds requires --package-manager pnpm or detected pnpm');
    }
    delete answers.gitConfigureRemote;

    const conflict = selectedFeatureConflict(answers, config.featureConflicts);
    if (conflict) {
      throw new Error(conflict);
    }
    if (isAppSeed(answers.foundation) && opts.vite) {
      throw new Error('--vite cannot be combined with Next/Nuxt seeded foundations');
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
