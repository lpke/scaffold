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
  scaffold help --framework
  scaffold --framework --help`,
  },
  {
    topic: '--yes',
    names: ['-y', '--yes'],
    summary: 'Use defaults without prompts',
    help: `Usage: scaffold [dir] --yes
       scaffold [dir] -y

Use defaults without prompts. Suitable for scripts and CI.`,
  },
  {
    topic: '--dry-run',
    names: ['--dry-run'],
    summary: 'Print planned changes only',
    help: `Usage: scaffold [dir] --dry-run

Print file changes and commands without writing files or running tools.`,
  },
  {
    topic: '--nix',
    names: ['--nix', '--no-nix'],
    summary: 'Create or skip flake.nix',
    help: `Usage: scaffold [dir] --nix
       scaffold [dir] --no-nix

Create or skip a Nix flake dev shell.`,
  },
  {
    topic: '--direnv',
    names: ['--direnv', '--no-direnv'],
    summary: 'Create or skip .envrc',
    help: `Usage: scaffold [dir] --direnv
       scaffold [dir] --no-direnv

Create or skip .envrc. This scaffold uses direnv with Nix flakes.`,
  },
  {
    topic: '--node-project',
    names: ['--node-project', '--no-node-project'],
    summary: 'Create or skip Node project files',
    help: `Usage: scaffold [dir] --node-project
       scaffold [dir] --no-node-project

Create or skip package.json, Node engine defaults, and JavaScript/TypeScript starter files.`,
  },
  {
    topic: '--node',
    names: ['--node'],
    summary: 'Set Node major version',
    help: `Usage: scaffold [dir] --node <major>

Choose Node major for package.json engines and flake.nix.

Values: 26, 24, 22, 20, 18, 16`,
  },
  {
    topic: '--package-manager',
    names: ['--package-manager'],
    summary: 'Set package manager',
    help: `Usage: scaffold [dir] --package-manager <pnpm|yarn|npm|keep>

Set package.json packageManager and package manager engine. "keep" is valid only when an existing package manager can be detected.`,
  },
  {
    topic: '--prettier',
    names: ['--prettier', '--no-prettier'],
    summary: 'Create or skip Prettier config',
    help: `Usage: scaffold [dir] --prettier
       scaffold [dir] --no-prettier

Create or skip Prettier config, Prettier dependency, and format/format:all package.json scripts.`,
  },
  {
    topic: '--tailwind-prettier',
    names: ['--tailwind-prettier'],
    summary: 'Use Tailwind Prettier config',
    help: `Usage: scaffold [dir] --tailwind-prettier

Use prettier.config.mjs with prettier-plugin-tailwindcss instead of .prettierrc.`,
  },
  {
    topic: '--framework',
    names: ['--framework'],
    summary: 'Set framework',
    help: `Usage: scaffold [dir] --framework <none|next|nuxt>

Choose framework. "next" runs create-next-app. "nuxt" runs nuxi init. "none" uses local templates.`,
  },
  {
    topic: '--framework-version',
    names: ['--framework-version'],
    summary: 'Set framework generator version',
    help: `Usage: scaffold [dir] --framework-version <version|latest>

Choose framework generator package version. Default is latest from npm view.`,
  },
  {
    topic: '--typescript',
    names: ['--typescript', '--no-typescript'],
    summary: 'Use or skip TypeScript',
    help: `Usage: scaffold [dir] --typescript
       scaffold [dir] --no-typescript

Create TypeScript config/source, or JavaScript source only.`,
  },
  {
    topic: '--strict',
    names: ['--strict', '--non-strict', '--preserve-ts'],
    summary: 'Set TypeScript strictness',
    help: `Usage: scaffold [dir] --strict
       scaffold [dir] --non-strict
       scaffold [dir] --preserve-ts

Set strict compiler options, non-strict compiler options, or preserve an existing tsconfig.`,
  },
  {
    topic: '--vite',
    names: ['--vite', '--no-vite'],
    summary: 'Use or skip Vite',
    help: `Usage: scaffold [dir] --vite
       scaffold [dir] --no-vite

Use local Vite starter files when no framework is selected.`,
  },
  {
    topic: '--dev-server',
    names: ['--dev-server', '--no-dev-server'],
    summary: 'Create or skip dev server scripts',
    help: `Usage: scaffold [dir] --dev-server
       scaffold [dir] --no-dev-server

Create or skip Vite dev and preview package.json scripts.`,
  },
  {
    topic: '--dev-port',
    names: ['--dev-port'],
    summary: 'Set dev server port',
    help: `Usage: scaffold [dir] --dev-port <port>

Set Vite dev/preview port. Default: 3000.`,
  },
  {
    topic: '--vitest',
    names: ['--vitest', '--no-vitest'],
    summary: 'Use or skip Vitest',
    help: `Usage: scaffold [dir] --vitest
       scaffold [dir] --no-vitest

Add Vitest scripts, dependency, and config for local Vite projects.`,
  },
  {
    topic: '--react',
    names: ['--react', '--no-react'],
    summary: 'Use or skip React starter',
    help: `Usage: scaffold [dir] --react
       scaffold [dir] --no-react

Add minimal React source/dependencies. Vue prompt is skipped when React is selected.`,
  },
  {
    topic: '--vue',
    names: ['--vue', '--no-vue'],
    summary: 'Use or skip Vue starter',
    help: `Usage: scaffold [dir] --vue
       scaffold [dir] --no-vue

Add minimal Vue source/dependencies. Only used when React is not selected.`,
  },
  {
    topic: '--license',
    names: ['--license', '--no-license'],
    summary: 'Create or skip license files',
    help: `Usage: scaffold [dir] --license
       scaffold [dir] --no-license

Add LICENSE, README license note, and package.json license field when package.json exists.`,
  },
  {
    topic: '--license-type',
    names: ['--license-type'],
    summary: 'Set license type',
    help: `Usage: scaffold [dir] --license-type <id>

Built-in values: AGPL-3.0-only, MIT, Apache-2.0, GPL-3.0-only, UNLICENSED.`,
  },
  {
    topic: '--agents',
    names: ['--agents', '--no-agents'],
    summary: 'Create or skip AGENTS.md',
    help: `Usage: scaffold [dir] --agents
       scaffold [dir] --no-agents

Create AGENTS.md with Tech and Rules sections based on scaffold choices.`,
  },
  {
    topic: '--flake-lock',
    names: ['--flake-lock', '--no-flake-lock'],
    summary: 'Run or skip nix flake lock',
    help: `Usage: scaffold [dir] --flake-lock
       scaffold [dir] --no-flake-lock

Run or skip nix flake lock after writing files.`,
  },
  {
    topic: '--install',
    names: ['--install', '--no-install'],
    summary: 'Run or skip package install',
    help: `Usage: scaffold [dir] --install
       scaffold [dir] --no-install

Run or skip package manager install after writing files.`,
  },
  {
    topic: '--git',
    names: ['--git'],
    summary: 'Set git handling',
    help: `Usage: scaffold [dir] --git <auto|skip|keep|init|replace>

auto: prompt/default based on target state.
skip: no git actions.
keep: use existing repo.
init: initialize a new repo when none exists.
replace: remove target .git, initialize a new repo, commit current files as "initial commit", then stage scaffold changes.`,
  },
  {
    topic: '--git-remote',
    names: ['--git-remote'],
    summary: 'Set git remote URL',
    help: `Usage: scaffold [dir] --git-remote <url>

Add or update a git remote after git setup. Also configures main to track <remote>/main without pushing. Use with --git-remote-name to change remote name.`,
  },
  {
    topic: '--git-remote-name',
    names: ['--git-remote-name'],
    summary: 'Set git remote name',
    help: `Usage: scaffold [dir] --git-remote-name <name>

Remote name used with --git-remote. Default: origin.`,
  },
  {
    topic: '--git-add',
    names: ['--git-add', '--no-git-add'],
    summary: 'Run or skip git add',
    help: `Usage: scaffold [dir] --git-add
       scaffold [dir] --no-git-add

Run or skip git add --all for the target directory when target is in a git repo.`,
  },
  {
    topic: '--force',
    names: ['--force'],
    summary: 'Overwrite starter files',
    help: `Usage: scaffold [dir] --force

Overwrite starter/template files when they already exist. package.json is still merged.`,
  },
  {
    topic: '--backup',
    names: ['--backup', '--no-backup'],
    summary: 'Create or skip backups',
    help: `Usage: scaffold [dir] --backup
       scaffold [dir] --no-backup

Create or skip one-time *.scaffold-backup files before overwriting existing files.`,
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
  console.log(`Usage: scaffold <dir> [options]
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
  scaffold help --framework
  scaffold --framework --help`);
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
      case '--git-add':
        setBool('gitAdd', true);
        break;
      case '--no-git-add':
        setBool('gitAdd', false);
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
      case '--tailwind-prettier':
        opts.tailwindPrettier = true;
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
      case '--framework':
      case '--framework-version':
      case '--dev-port':
      case '--license-type':
      case '--git':
      case '--git-remote':
      case '--git-remote-name': {
        const value = valueAfter(argv, index, arg);
        index += 1;
        if (arg === '--node') opts.nodeMajor = value;
        if (arg === '--package-manager') opts.packageManager = value;
        if (arg === '--framework') opts.framework = value;
        if (arg === '--framework-version') opts.frameworkVersion = value;
        if (arg === '--dev-port') opts.devPort = value;
        if (arg === '--license-type') opts.licenseType = value;
        if (arg === '--git') opts.gitMode = value;
        if (arg === '--git-remote') opts.gitRemote = value;
        if (arg === '--git-remote-name') opts.gitRemoteName = value;
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
