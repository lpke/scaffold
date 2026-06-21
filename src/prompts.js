'use strict';

const path = require('node:path');

const { nodeChoices } = require('./config');
const { detectGit, detectNodeMajor, detectPackageManager, listGitRemotes, npmLatest } = require('./detect');
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

const valueChoice = async (rl, opts, key, message, choices, defaultValue) => {
  if (opts[key] != null) {
    return opts[key];
  }
  if (!rl) {
    return defaultValue;
  }
  return promptChoice(rl, message, choices, defaultValue);
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

const validatePort = (value) => {
  const port = Number(value);
  return Number.isInteger(port) && port > 0 && port <= 65535
    ? true
    : 'Enter a port from 1 to 65535.';
};

const resolveGitAnswers = async ({ rl, opts, targetDir }) => {
  const git = detectGit(targetDir);
  const validModes = ['auto', 'skip', 'keep', 'init', 'replace'];
  let gitMode = opts.gitMode ?? 'auto';
  if (!validModes.includes(gitMode)) {
    throw new Error(`Unknown git mode: ${gitMode}`);
  }

  if (gitMode === 'auto') {
    if (!rl) {
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
        'keep',
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
        'keep',
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
    const defaultConfigure = Boolean(opts.gitRemote);
    const configure = await promptYesNo(
      rl,
      remotes.length > 0
        ? `Configure git remote? ${color.dim(`existing: ${remotes.join(', ')}`)}`
        : 'Configure git remote?',
      defaultConfigure,
    );
    if (configure) {
      gitRemote = await promptText(rl, `Remote URL for ${gitRemoteName}`, '', (value) =>
        value ? true : 'Remote URL is required.',
      );
    }
  }

  const gitAdd =
    opts.gitAdd ??
    (canRemote && (git.inside || gitMode === 'init' || gitMode === 'replace')
      ? rl
        ? await promptYesNo(rl, 'Mark generated files with git add -N?', true)
        : true
      : false);

  return {
    gitAdd,
    gitMode,
    gitRemote,
    gitRemoteName,
  };
};

const resolveAnswers = async ({ opts, targetDir, existingPackage, config }) => {
  const interactive = isInteractive(opts);
  const rl = interactive ? createPrompter() : null;

  try {
    const hasPackage = Boolean(existingPackage);
    const detectedManager = await detectPackageManager(targetDir, existingPackage, config);
    const detectedNodeMajor = detectNodeMajor(existingPackage, config);

    const answers = {
      backup: opts.backup,
      dryRun: opts.dryRun,
      force: opts.force,
      tailwindPrettier: Boolean(opts.tailwindPrettier),
    };

    answers.nix = await boolChoice(rl, opts, 'nix', 'Use nix flake?', true);
    answers.direnv = answers.nix
      ? await boolChoice(rl, opts, 'direnv', 'Use direnv?', true)
      : false;
    if (!answers.nix && opts.direnv) {
      throw new Error('--direnv requires --nix because the managed .envrc uses "use flake"');
    }

    const frameworkRequested = opts.framework && opts.framework !== 'none';
    answers.nodeProject = frameworkRequested
      ? true
      : await boolChoice(rl, opts, 'nodeProject', 'Node project?', true);

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

      answers.prettier = await boolChoice(rl, opts, 'prettier', 'Prettier?', true);

      answers.framework = await valueChoice(
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
        const latest = latestFrameworkVersion({ config, framework: answers.framework });
        const defaultVersion = opts.frameworkVersion || latest || 'latest';
        if (latest) {
          console.log('');
          console.log(color.dim(`${config.frameworks[answers.framework].label} latest: ${latest}`));
        } else if (interactive) {
          console.log('');
          console.log(color.yellow(`Could not check latest ${answers.framework} version; using latest.`));
        }
        answers.frameworkVersion = await valueChoice(
          rl,
          opts,
          'frameworkVersion',
          'Framework version?',
          [
            { label: latest ? `latest (${latest})` : 'latest', value: latest || 'latest' },
            { label: 'latest tag', value: 'latest' },
          ],
          defaultVersion,
        );
      } else {
        answers.frameworkVersion = null;
      }

      answers.typescript = await boolChoice(rl, opts, 'typescript', 'TypeScript?', true);
      answers.tsMode = answers.typescript
        ? await valueChoice(
            rl,
            opts,
            'tsMode',
            'TypeScript strictness?',
            [
              { label: 'preserve existing', value: 'preserve' },
              { label: 'strict', value: 'strict' },
              { label: 'non-strict', value: 'non-strict' },
            ],
            hasPackage ? 'preserve' : 'strict',
          )
        : 'preserve';

      if (answers.framework === 'none') {
        answers.vite = await boolChoice(rl, opts, 'vite', 'Vite?', true);
        answers.devServer = answers.vite
          ? await boolChoice(rl, opts, 'devServer', 'Dev server script?', true)
          : false;
        answers.devPort = answers.devServer
          ? Number(
              opts.devPort ??
                (rl ? await promptText(rl, 'Dev server port?', '3000', validatePort) : '3000'),
            )
          : 3000;
        answers.vitest = answers.vite
          ? await boolChoice(rl, opts, 'vitest', 'Vitest?', false)
          : false;
        answers.react = await boolChoice(rl, opts, 'react', 'React?', false);
        answers.vue = answers.react
          ? false
          : await boolChoice(rl, opts, 'vue', 'Vue?', false);
      } else {
        answers.vite = false;
        answers.devServer = false;
        answers.devPort = 3000;
        answers.vitest = false;
        answers.react = answers.framework === 'next';
        answers.vue = answers.framework === 'nuxt';
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

    answers.agents = await boolChoice(rl, opts, 'agents', 'AGENTS.md?', true);

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
