'use strict';

const { color } = require('./ui');

const FLAG_TOPICS = [
  {
    topic: 'help',
    names: ['help'],
    summary: 'Show top-level help or detailed flag help',
    help: `Usage: scaffold help [topic]

Show top-level help, or detailed help for a command or flag.

Examples:
  scaffold help
  scaffold help --foundation
  scaffold --foundation --help`,
  },
  {
    topic: '--yes',
    names: ['-y', '--yes'],
    summary: 'Use defaults without prompts',
    help: `Usage: scaffold [target] --yes
       scaffold [target] -y

Use defaults without prompts. Suitable for scripts and CI.`,
  },
  {
    topic: '--dry-run',
    names: ['--dry-run'],
    summary: 'Print planned changes only',
    help: `Usage: scaffold [target] --dry-run

Print file changes and commands without writing files or running tools.`,
  },
  {
    topic: '--nix',
    names: ['--nix', '--no-nix'],
    summary: 'Create or skip flake.nix',
    help: `Usage: scaffold [target] --nix
       scaffold [target] --no-nix

Create or skip a Nix flake dev shell.`,
  },
  {
    topic: '--direnv',
    names: ['--direnv', '--no-direnv'],
    summary: 'Create or skip .envrc',
    help: `Usage: scaffold [target] --direnv
       scaffold [target] --no-direnv

Create or skip .envrc. This scaffold uses direnv with Nix flakes.`,
  },
  {
    topic: '--node-project',
    names: ['--node-project', '--no-node-project'],
    summary: 'Create or skip Node project files',
    help: `Usage: scaffold [target] --node-project
       scaffold [target] --no-node-project

Create or skip package.json, Node engine defaults, and owned foundation templates.`,
  },
  {
    topic: '--node',
    names: ['--node'],
    summary: 'Set Node major version',
    help: `Usage: scaffold [target] --node <major>

Choose Node major for package.json engines and flake.nix.

Values: 26, 24, 22, 20, 18, 16`,
  },
  {
    topic: '--package-manager',
    names: ['--package-manager'],
    summary: 'Set package manager',
    help: `Usage: scaffold [target] --package-manager <pnpm|yarn|npm|keep>

Set package.json packageManager and package manager engine. "keep" is valid only when an existing package manager can be detected.`,
  },
  {
    topic: '--foundation',
    names: ['--foundation'],
    summary: 'Set foundation',
    help: `Usage: scaffold [target] --foundation <owned|next|nuxt|react-vite|vue-vite>

Choose the starting template. "owned" copies scaffold custom templates. Other values run a seed command, then scaffold applies defaults, features, and seeded-foundation overrides.`,
  },
  {
    topic: '--seed-version',
    names: ['--seed-version'],
    summary: 'Set seed package version',
    help: `Usage: scaffold [target] --foundation <next|nuxt|react-vite|vue-vite> --seed-version <version|latest>

Choose the seed package version used by the seed command. Default is the latest dist-tag.`,
  },
  {
    topic: '--prettier',
    names: ['--prettier', '--no-prettier'],
    summary: 'Use or skip Prettier',
    help: `Usage: scaffold [target] --prettier
       scaffold [target] --no-prettier

Add Prettier config, dependency, format scripts, and final formatting.`,
  },
  {
    topic: '--tailwind',
    names: ['--tailwind', '--no-tailwind'],
    summary: 'Use or skip Tailwind support',
    help: `Usage: scaffold [target] --tailwind
       scaffold [target] --no-tailwind

Enable Tailwind-aware scaffold behavior. Owned Vite foundations install Tailwind CSS and wire the Vite plugin/CSS entry. Next.js seed commands receive --tailwind or --no-tailwind.`,
  },
  {
    topic: '--nuxt-offline',
    names: ['--nuxt-offline', '--nuxt-prefer-offline'],
    summary: 'Use Nuxt seed offline modes',
    help: `Usage: scaffold [target] --foundation nuxt --nuxt-offline
       scaffold [target] --foundation nuxt --nuxt-prefer-offline

Pass --offline or --preferOffline to the Nuxt seed command.`,
  },
  {
    topic: '--typescript',
    names: ['--typescript', '--no-typescript'],
    summary: 'Use or skip TypeScript',
    help: `Usage: scaffold [target] --typescript
       scaffold [target] --no-typescript

Create TypeScript config/source, or JavaScript source only.`,
  },
  {
    topic: '--strict',
    names: ['--strict', '--non-strict', '--preserve-ts'],
    summary: 'Set TypeScript strictness',
    help: `Usage: scaffold [target] --strict
       scaffold [target] --non-strict
       scaffold [target] --preserve-ts

Set strict compiler options, non-strict compiler options, or preserve an existing tsconfig. Implies --typescript.`,
  },
  {
    topic: '--vite',
    names: ['--vite', '--no-vite'],
    summary: 'Use or skip Vite feature',
    help: `Usage: scaffold [target] --foundation owned --vite
       scaffold [target] --foundation owned --no-vite

Use owned Vite template files. Seeded Vite foundations set this automatically.`,
  },
  {
    topic: '--no-feature-prompts',
    names: ['--no-feature-prompts'],
    summary: 'Skip optional feature prompts',
    help: `Usage: scaffold [target] --no-feature-prompts

Skip optional frontend feature prompts for the owned foundation.`,
  },
  {
    topic: '--dev-server',
    names: ['--dev-server', '--no-dev-server'],
    summary: 'Create or skip dev server scripts',
    help: `Usage: scaffold [target] --dev-server
       scaffold [target] --no-dev-server

Create or skip Vite dev and preview package.json scripts.`,
  },
  {
    topic: '--dev-port',
    names: ['--dev-port'],
    summary: 'Set dev server port',
    help: `Usage: scaffold [target] --dev-port <port>

Set Vite dev/preview port. Implies --vite and --dev-server for the owned foundation. Default: 3000.`,
  },
  {
    topic: '--vitest',
    names: ['--vitest', '--no-vitest'],
    summary: 'Use or skip Vitest',
    help: `Usage: scaffold [target] --vitest
       scaffold [target] --no-vitest

Add Vitest with a Node test environment, scripts, config, and a sample test.`,
  },
  {
    topic: '--vitest-jsdom',
    names: ['--vitest-jsdom', '--no-vitest-jsdom'],
    summary: 'Use or skip Vitest jsdom testing',
    help: `Usage: scaffold [target] --vitest-jsdom
       scaffold [target] --no-vitest-jsdom

Add a jsdom project for *.dom.test.* files. --vitest-jsdom implies --vitest.`,
  },
  {
    topic: '--vitest-browser',
    names: ['--vitest-browser', '--no-vitest-browser'],
    summary: 'Use or skip Vitest browser testing',
    help: `Usage: scaffold [target] --vitest-browser
       scaffold [target] --no-vitest-browser

Add a Playwright browser project for *.browser.test.* files. --vitest-browser implies --vitest. Non-Nix installs also install Chromium.`,
  },
  {
    topic: '--jsonplaceholder-types',
    names: ['--jsonplaceholder-types', '--no-jsonplaceholder-types'],
    summary: 'Create or skip JSONPlaceholder TypeScript types',
    help: `Usage: scaffold [target] --jsonplaceholder-types
       scaffold [target] --no-jsonplaceholder-types

Add JSONPlaceholder resource types and endpoint JSDoc at the convention-aware TypeScript types path. Implies --typescript unless --no-typescript is passed, which is invalid.`,
  },
  {
    topic: '--react',
    names: ['--react', '--no-react'],
    summary: 'Use or skip React feature',
    help: `Usage: scaffold [target] --react
       scaffold [target] --no-react

Add React source/dependencies for the owned foundation. React seeded foundations set this automatically.`,
  },
  {
    topic: '--vue',
    names: ['--vue', '--no-vue'],
    summary: 'Use or skip Vue feature',
    help: `Usage: scaffold [target] --vue
       scaffold [target] --no-vue

Add Vue source/dependencies for the owned foundation. Vue seeded foundations set this automatically.`,
  },
  {
    topic: '--jsx',
    names: ['--jsx', '--no-jsx'],
    summary: 'Use or skip Vue JSX support',
    help: `Usage: scaffold [target] --foundation vue-vite --jsx
       scaffold [target] --foundation vue-vite --no-jsx

Pass --jsx to the create-vue seed command.`,
  },
  {
    topic: '--router',
    names: ['--router', '--no-router'],
    summary: 'Use or skip frontend router',
    help: `Usage: scaffold [target] --foundation react-vite --router
       scaffold [target] --foundation vue-vite --router
       scaffold [target] --foundation vue-vite --no-router

Add React Router after the React + Vite seed, or pass --router to create-vue.`,
  },
  {
    topic: '--pinia',
    names: ['--pinia', '--no-pinia'],
    summary: 'Use or skip Pinia',
    help: `Usage: scaffold [target] --foundation vue-vite --pinia
       scaffold [target] --foundation vue-vite --no-pinia

Pass --pinia to the create-vue seed command.`,
  },
  {
    topic: '--eslint',
    names: ['--eslint', '--no-eslint', '--linter', '--no-linter'],
    summary: 'Use or skip Vue linter',
    help: `Usage: scaffold [target] --foundation vue-vite --eslint
       scaffold [target] --foundation vue-vite --no-eslint

Pass --eslint to the create-vue seed command. --linter is an alias.`,
  },
  {
    topic: '--license',
    names: ['--license', '--no-license'],
    summary: 'Create or skip license files',
    help: `Usage: scaffold [target] --license
       scaffold [target] --no-license

Add LICENSE, README license note, and package.json license field when package.json exists.`,
  },
  {
    topic: '--license-type',
    names: ['--license-type'],
    summary: 'Set license type',
    help: `Usage: scaffold [target] --license-type <id>

Implies --license. Built-in values: AGPL-3.0-only, MIT, Apache-2.0, GPL-3.0-only, UNLICENSED.`,
  },
  {
    topic: '--agents',
    names: ['--agents', '--no-agents'],
    summary: 'Create or skip AGENTS.md',
    help: `Usage: scaffold [target] --agents
       scaffold [target] --no-agents

Create AGENTS.md with Tech and Rules sections based on scaffold answers.`,
  },
  {
    topic: '--flake-lock',
    names: ['--flake-lock', '--no-flake-lock'],
    summary: 'Run or skip nix flake lock',
    help: `Usage: scaffold [target] --flake-lock
       scaffold [target] --no-flake-lock

Run or skip nix flake lock after writing files. --flake-lock implies --nix.`,
  },
  {
    topic: '--install',
    names: ['--install', '--no-install'],
    summary: 'Run or skip package install',
    help: `Usage: scaffold [target] --install
       scaffold [target] --no-install

Run or skip package manager install after writing files.`,
  },
  {
    topic: '--pnpm-approve-builds',
    names: ['--pnpm-approve-builds', '--no-pnpm-approve-builds'],
    summary: 'Auto-approve pnpm blocked build scripts',
    help: `Usage: scaffold [target] --install --pnpm-approve-builds
       scaffold [target] --install --no-pnpm-approve-builds

When pnpm install fails with ERR_PNPM_IGNORED_BUILDS, run pnpm approve-builds --all and retry install.`,
  },
  {
    topic: '--git',
    names: ['--git'],
    summary: 'Set git handling',
    help: `Usage: scaffold [target] --git <auto|skip|keep|init|replace>

auto: prompt/default based on target state.
skip: no git actions.
keep: use existing repo.
init: initialize a new repo when none exists.
replace: remove target .git, initialize a new repo, commit current files as "initial commit", then stage scaffold changes.`,
  },
  {
    topic: '--commit-overrides',
    names: ['--commit-overrides', '--no-commit-overrides'],
    summary: 'Commit scaffold overrides',
    help: `Usage: scaffold [target] --commit-overrides
       scaffold [target] --no-commit-overrides

Commit scaffold defaults, features, and overrides after writing and formatting files. Requires git handling to be enabled.`,
  },
  {
    topic: '--git-remote',
    names: ['--git-remote'],
    summary: 'Set git remote URL',
    help: `Usage: scaffold [target] --git-remote <url>

Add or update a git remote after git setup. Also configures main to track <remote>/main without pushing. Use with --git-remote-name to change remote name.`,
  },
  {
    topic: '--git-remote-name',
    names: ['--git-remote-name'],
    summary: 'Set git remote name',
    help: `Usage: scaffold [target] --git-remote-name <name>

Remote name used with --git-remote. With prompts enabled, omitting --git-remote asks for the URL. Default: origin.`,
  },
  {
    topic: '--git-push',
    names: ['--git-push', '--no-git-push'],
    summary: 'Push main to the git remote',
    help: `Usage: scaffold [target] --git-push
       scaffold [target] --no-git-push

Run git push -u origin main after git setup when a git remote is configured. Default: no.`,
  },
  {
    topic: '--git-add',
    names: ['--git-add', '--no-git-add'],
    summary: 'Run or skip git add',
    help: `Usage: scaffold [target] --git-add
       scaffold [target] --no-git-add

Run or skip git add --all for the target directory when target is in a git repo.`,
  },
  {
    topic: '--force',
    names: ['--force'],
    summary: 'Overwrite template files',
    help: `Usage: scaffold [target] --force

Overwrite template files when they already exist. package.json is still merged.`,
  },
  {
    topic: '--backup',
    names: ['--backup', '--no-backup'],
    summary: 'Create or skip backups',
    help: `Usage: scaffold [target] --backup
       scaffold [target] --no-backup

Create or skip one-time *.scaffold-backup files before overwriting existing files. Filesystem backups are only written when git mode is skip; git history is the backup for git-backed scaffolds.`,
  },
];

const topicByName = new Map();
for (const topic of FLAG_TOPICS) {
  for (const name of topic.names) {
    topicByName.set(name, topic);
    if (name.startsWith('--')) {
      topicByName.set(name.slice(2), topic);
    }
  }
}

const isHelpFlag = (arg) => arg === '-h' || arg === '--help';

const printUsage = () => {
  console.log(`Usage: scaffold <target> [options]
       scaffold help [topic]

Scaffold a project with editable local defaults.

Commands:
  help [topic]                  Show top-level help or detailed flag help

Options:`);
  for (const topic of FLAG_TOPICS.filter((item) => item.topic !== 'help')) {
    const names = topic.names.join(', ');
    console.log(`  ${names.padEnd(31)} ${topic.summary}`);
  }
  console.log(`
Examples:
  scaffold my-app
  scaffold . --dry-run
  scaffold help --foundation
  scaffold --foundation --help`);
};

const printTopic = (name) => {
  const topic = topicByName.get(name);
  if (!topic) {
    throw new Error(`Unknown help topic: ${name}`);
  }
  console.log(topic.help);
};

const printRequestedHelp = (argv) => {
  if (argv.length === 0) {
    printUsage();
    return true;
  }

  if (argv[0] === 'help') {
    const topics = argv.slice(1).filter((arg) => !isHelpFlag(arg));
    if (topics.length === 0) {
      if (argv.slice(1).some(isHelpFlag)) {
        printTopic('help');
      } else {
        printUsage();
      }
      return true;
    }
    if (topics.length > 1) {
      throw new Error('Usage: scaffold help [topic]');
    }
    printTopic(topics[0]);
    return true;
  }

  if (argv.some(isHelpFlag)) {
    const topicArg = argv.find((arg) => !isHelpFlag(arg) && topicByName.has(arg));
    if (topicArg) {
      printTopic(topicArg);
    } else {
      printUsage();
    }
    return true;
  }

  return false;
};

const valueAfter = (argv, index, arg) => {
  const value = argv[index + 1];
  if (!value || value.startsWith('-')) {
    throw new Error(`Missing value for ${arg}`);
  }
  return value;
};

const parseArgs = (argv) => {
  const opts = {
    backup: true,
    dir: null,
    dryRun: false,
    force: false,
    gitRemoteName: 'origin',
    gitRemoteNameProvided: false,
    yes: false,
  };

  const setBool = (key, value) => {
    opts[key] = value;
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case '-y':
      case '--yes':
        opts.yes = true;
        break;
      case '--dry-run':
        opts.dryRun = true;
        break;
      case '--nix':
        setBool('nix', true);
        break;
      case '--no-nix':
        setBool('nix', false);
        break;
      case '--direnv':
        setBool('direnv', true);
        break;
      case '--no-direnv':
        setBool('direnv', false);
        break;
      case '--node-project':
        setBool('nodeProject', true);
        break;
      case '--no-node-project':
        setBool('nodeProject', false);
        break;
      case '--prettier':
        setBool('prettier', true);
        break;
      case '--no-prettier':
        setBool('prettier', false);
        break;
      case '--tailwind':
        setBool('tailwind', true);
        break;
      case '--no-tailwind':
        setBool('tailwind', false);
        break;
      case '--typescript':
        setBool('typescript', true);
        break;
      case '--no-typescript':
        setBool('typescript', false);
        break;
      case '--vite':
        setBool('vite', true);
        break;
      case '--no-vite':
        setBool('vite', false);
        break;
      case '--no-feature-prompts':
        setBool('featurePrompts', false);
        break;
      case '--nuxt-offline':
        setBool('nuxtOffline', true);
        break;
      case '--nuxt-prefer-offline':
        setBool('nuxtPreferOffline', true);
        break;
      case '--dev-server':
        setBool('devServer', true);
        break;
      case '--no-dev-server':
        setBool('devServer', false);
        break;
      case '--vitest':
        setBool('vitest', true);
        break;
      case '--no-vitest':
        setBool('vitest', false);
        break;
      case '--vitest-jsdom':
        setBool('vitestJsdom', true);
        break;
      case '--no-vitest-jsdom':
        setBool('vitestJsdom', false);
        break;
      case '--vitest-browser':
        setBool('vitestBrowser', true);
        break;
      case '--no-vitest-browser':
        setBool('vitestBrowser', false);
        break;
      case '--jsonplaceholder-types':
        setBool('jsonplaceholderTypes', true);
        break;
      case '--no-jsonplaceholder-types':
        setBool('jsonplaceholderTypes', false);
        break;
      case '--react':
        setBool('react', true);
        break;
      case '--no-react':
        setBool('react', false);
        break;
      case '--vue':
        setBool('vue', true);
        break;
      case '--no-vue':
        setBool('vue', false);
        break;
      case '--jsx':
        setBool('jsx', true);
        break;
      case '--no-jsx':
        setBool('jsx', false);
        break;
      case '--router':
        setBool('router', true);
        break;
      case '--no-router':
        setBool('router', false);
        break;
      case '--pinia':
        setBool('pinia', true);
        break;
      case '--no-pinia':
        setBool('pinia', false);
        break;
      case '--eslint':
      case '--linter':
        setBool('eslint', true);
        break;
      case '--no-eslint':
      case '--no-linter':
        setBool('eslint', false);
        break;
      case '--license':
        setBool('license', true);
        break;
      case '--no-license':
        setBool('license', false);
        break;
      case '--agents':
        setBool('agents', true);
        break;
      case '--no-agents':
        setBool('agents', false);
        break;
      case '--flake-lock':
        setBool('flakeLock', true);
        break;
      case '--no-flake-lock':
        setBool('flakeLock', false);
        break;
      case '--install':
        setBool('install', true);
        break;
      case '--no-install':
        setBool('install', false);
        break;
      case '--pnpm-approve-builds':
        setBool('pnpmApproveBuilds', true);
        break;
      case '--no-pnpm-approve-builds':
        setBool('pnpmApproveBuilds', false);
        break;
      case '--git-add':
        setBool('gitAdd', true);
        break;
      case '--no-git-add':
        setBool('gitAdd', false);
        break;
      case '--git-push':
        setBool('gitPush', true);
        break;
      case '--no-git-push':
        setBool('gitPush', false);
        break;
      case '--commit-overrides':
        setBool('commitOverrides', true);
        break;
      case '--no-commit-overrides':
        setBool('commitOverrides', false);
        break;
      case '--force':
        opts.force = true;
        break;
      case '--backup':
        opts.backup = true;
        break;
      case '--no-backup':
        opts.backup = false;
        break;
      case '--strict':
        opts.tsMode = 'strict';
        break;
      case '--non-strict':
        opts.tsMode = 'non-strict';
        break;
      case '--preserve-ts':
        opts.tsMode = 'preserve';
        break;
      case '--node':
      case '--package-manager':
      case '--foundation':
      case '--seed-version':
      case '--dev-port':
      case '--license-type':
      case '--git':
      case '--git-remote':
      case '--git-remote-name': {
        const value = valueAfter(argv, index, arg);
        index += 1;
        if (arg === '--node') opts.nodeMajor = value;
        if (arg === '--package-manager') opts.packageManager = value;
        if (arg === '--foundation') opts.foundation = value;
        if (arg === '--seed-version') opts.seedVersion = value;
        if (arg === '--dev-port') opts.devPort = value;
        if (arg === '--license-type') opts.licenseType = value;
        if (arg === '--git') opts.gitMode = value;
        if (arg === '--git-remote') opts.gitRemote = value;
        if (arg === '--git-remote-name') {
          opts.gitRemoteName = value;
          opts.gitRemoteNameProvided = true;
        }
        break;
      }
      default:
        if (arg.startsWith('-')) {
          throw new Error(`Unknown option: ${arg}. Try ${color.green('scaffold help')}.`);
        }
        if (opts.dir) {
          throw new Error(`Unexpected extra argument: ${arg}`);
        }
        opts.dir = arg;
    }
  }

  return opts;
};

module.exports = {
  parseArgs,
  printRequestedHelp,
};
