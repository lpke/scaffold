#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

find src -name '*.js' -print -exec node --check {} \;
node --check bin/scaffold

test -f share/config.json
test -d share/templates
test -d share/templates/owned
test -d share/templates/seeded
test -d share/templates/shared
test -f share/overrides/common/defaults.json
test ! -e share/scaffold

bin/scaffold --help >/dev/null
bin/scaffold help --foundation >/dev/null

for flag in \
  --yes --dry-run --nix --no-nix --direnv --no-direnv \
  --node-project --no-node-project --node --package-manager \
  --foundation --seed-version \
  --prettier --no-prettier --tailwind --no-tailwind --typescript --no-typescript --strict \
  --nuxt-offline --nuxt-prefer-offline \
  --non-strict --preserve-ts --vite --no-vite --no-feature-prompts --dev-server \
  --no-dev-server --dev-port --vitest --no-vitest --vitest-browser --no-vitest-browser \
  --jsonplaceholder-types --no-jsonplaceholder-types --react \
  --no-react --vue --no-vue --jsx --no-jsx --router --no-router \
  --pinia --no-pinia --eslint --no-eslint --linter --no-linter \
  --license --no-license --license-type \
  --agents --no-agents --flake-lock --no-flake-lock --install \
  --no-install --git --git-remote --git-remote-name --git-add \
  --no-git-add --git-push --no-git-push --commit-overrides \
  --no-commit-overrides --force --backup --no-backup
do
  bin/scaffold "$flag" --help >/dev/null
  bin/scaffold help "$flag" >/dev/null
done

node <<'NODE'
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { loadConfig } = require('./src/config');
const { parseArgs } = require('./src/cli');
const { buildSeedCommand } = require('./src/foundations');
const { applySeededFoundationOverrides } = require('./src/override-pass');
const { resolveTypescriptAnswers } = require('./src/prompt-features');
const { applyJsonplaceholderTypes, applyPackageJson } = require('./src/project');
const { applyVitestBrowser } = require('./src/vitest-browser');
const { Workspace } = require('./src/workspace');
const { applyActionManifest, applyActions } = require('./src/helpers/actions');

(async () => {
  const config = await loadConfig();
  const baseAnswers = {
    foundation: 'next',
    seedVersion: '15.0.0',
    install: false,
    toolchainManager: 'pnpm',
  };

  let command = buildSeedCommand({
    answers: { ...baseAnswers, tailwind: true, typescript: true },
    config,
    targetDir: '/tmp/scaffold-next',
  });
  for (const arg of ['--ts', '--eslint', '--react-compiler', '--tailwind', '--no-agents-md']) {
    assert(command.args.includes(arg), `missing ${arg}`);
  }
  assert(!command.args.includes('--typescript'));

  command = buildSeedCommand({
    answers: { ...baseAnswers, tailwind: false, typescript: false },
    config,
    targetDir: '/tmp/scaffold-next',
  });
  assert(command.args.includes('--js'));
  assert(command.args.includes('--no-tailwind'));
  assert(!command.args.includes('--javascript'));

  command = buildSeedCommand({
    answers: { ...baseAnswers, seedVersion: '15.0.0', install: true, tailwind: false, typescript: true },
    config,
    targetDir: '/tmp/scaffold-next',
  });
  assert(command.args.includes('--skip-install'));

  command = buildSeedCommand({
    answers: { ...baseAnswers, seedVersion: 'latest', install: true, tailwind: false, typescript: true },
    config,
    targetDir: '/tmp/scaffold-next',
  });
  assert(!command.args.includes('--skip-install'));

  command = buildSeedCommand({
    answers: { foundation: 'react-vite', seedVersion: 'latest', typescript: true, router: true },
    config,
    targetDir: '/tmp/scaffold-react',
  });
  assert.deepEqual(command.args.slice(-4), ['--', '--template', 'react-ts', '--no-interactive']);
  assert.equal(parseArgs(['--foundation', 'react-vite', '--router']).router, true);
  assert.equal(parseArgs(['--vitest-browser']).vitestBrowser, true);
  assert.equal(parseArgs(['--no-vitest-browser']).vitestBrowser, false);
  assert.equal(parseArgs(['--jsonplaceholder-types']).jsonplaceholderTypes, true);
  assert.equal(parseArgs(['--no-jsonplaceholder-types']).jsonplaceholderTypes, false);

  const assertJsonplaceholderTypesPath = async ({ foundation, seedVersion = null, dirs = [], expected }) => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `scaffold-jsonplaceholder-types-${foundation}-`));
    for (const dir of dirs) {
      fs.mkdirSync(path.join(tmp, dir), { recursive: true });
    }
    const workspace = new Workspace({
      targetDir: tmp,
      dryRun: false,
      backup: false,
      force: false,
    });
    await applyJsonplaceholderTypes(workspace, {
      foundation,
      seedVersion,
      typescript: true,
      jsonplaceholderTypes: true,
    });
    const dataTypes = fs.readFileSync(path.join(tmp, expected), 'utf8');
    assert(dataTypes.includes('JSONPlaceholder guide'));
    assert(dataTypes.includes('export type User'));
  };

  await assertJsonplaceholderTypesPath({ foundation: 'owned', expected: 'types/data.ts' });
  await assertJsonplaceholderTypesPath({ foundation: 'react-vite', expected: 'src/types/data.ts' });
  await assertJsonplaceholderTypesPath({ foundation: 'react-vite', dirs: ['src'], expected: 'src/types/data.ts' });
  await assertJsonplaceholderTypesPath({ foundation: 'vue-vite', dirs: ['src'], expected: 'src/types/data.ts' });
  await assertJsonplaceholderTypesPath({ foundation: 'next', expected: 'src/app/_types/data.ts' });
  await assertJsonplaceholderTypesPath({ foundation: 'next', dirs: ['src/app'], expected: 'src/app/_types/data.ts' });
  await assertJsonplaceholderTypesPath({ foundation: 'next', dirs: ['src'], expected: 'src/_types/data.ts' });
  await assertJsonplaceholderTypesPath({ foundation: 'nuxt', seedVersion: 'latest', expected: 'app/types/data.ts' });
  await assertJsonplaceholderTypesPath({ foundation: 'nuxt', seedVersion: '3.21.8', expected: 'types/data.ts' });
  await assertJsonplaceholderTypesPath({ foundation: 'nuxt', dirs: ['app'], expected: 'app/types/data.ts' });

  const assertViteSeedPortScripts = async ({ foundation, react, vue }) => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `scaffold-${foundation}-`));
    const workspace = new Workspace({
      targetDir: tmp,
      dryRun: false,
      backup: false,
      force: false,
    });
    const pkg = {
      name: `seeded-${foundation}`,
      version: '0.0.0',
      type: 'module',
      scripts: {
        dev: 'vite',
        build: 'vite build',
      },
      dependencies: {},
      devDependencies: {},
    };
    await applyPackageJson({
      workspace,
      config,
      existingPackage: pkg,
      answers: {
        nodeProject: true,
        foundation,
        packageManager: 'keep',
        toolchainManager: 'npm',
        nodeMajor: '22',
        vite: true,
        devServer: true,
        devPort: 5177,
        typescript: true,
        vitest: false,
        prettier: false,
        tailwind: false,
        react,
        vue,
        router: false,
        license: false,
      },
    });
    const written = JSON.parse(fs.readFileSync(path.join(tmp, 'package.json'), 'utf8'));
    assert.equal(written.scripts.dev, 'vite --host 0.0.0.0 --port 5177');
    assert.equal(written.scripts['dev:nohost'], 'vite --port 5177');
  };

  await assertViteSeedPortScripts({ foundation: 'react-vite', react: true, vue: false });

  const assertTypecheckScript = async ({
    foundation,
    tsconfig,
    existingScripts = {},
    answers: answerOverrides = {},
    expected,
  }) => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `scaffold-typecheck-${foundation}-`));
    if (tsconfig) {
      fs.writeFileSync(path.join(tmp, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2));
    }
    const workspace = new Workspace({
      targetDir: tmp,
      dryRun: false,
      backup: false,
      force: false,
    });
    await applyPackageJson({
      workspace,
      config,
      existingPackage: {
        name: `typecheck-${foundation}`,
        version: '0.0.0',
        type: 'module',
        scripts: existingScripts,
        dependencies: {},
        devDependencies: {},
      },
      answers: {
        nodeProject: true,
        foundation,
        packageManager: 'keep',
        toolchainManager: 'npm',
        nodeMajor: '22',
        vite: false,
        devServer: false,
        devPort: 3000,
        typescript: true,
        vitest: false,
        prettier: false,
        tailwind: false,
        react: false,
        vue: false,
        router: false,
        license: false,
        ...answerOverrides,
      },
    });
    const written = JSON.parse(fs.readFileSync(path.join(tmp, 'package.json'), 'utf8'));
    assert.equal(written.scripts.typecheck, expected);
  };

  await assertTypecheckScript({
    foundation: 'react-vite',
    answers: { vite: true, react: true },
    tsconfig: { files: [], references: [{ path: './tsconfig.app.json' }, { path: './tsconfig.node.json' }] },
    expected: 'tsc -b --noEmit',
  });
  await assertTypecheckScript({
    foundation: 'vue-vite',
    answers: { vite: true, vue: true },
    existingScripts: { 'type-check': 'vue-tsc --build' },
    tsconfig: { files: [], references: [{ path: './tsconfig.app.json' }, { path: './tsconfig.node.json' }] },
    expected: 'vue-tsc --build',
  });
  await assertTypecheckScript({
    foundation: 'nuxt',
    answers: { vue: true },
    tsconfig: { files: [], references: [{ path: './.nuxt/tsconfig.app.json' }] },
    expected: 'tsc -b --noEmit',
  });
  await assertTypecheckScript({
    foundation: 'nuxt',
    answers: { vue: true, vitest: true },
    tsconfig: { extends: './.nuxt/tsconfig.json' },
    expected: 'tsc --noEmit',
  });
  await assertTypecheckScript({
    foundation: 'next',
    answers: { react: true },
    tsconfig: { include: ['next-env.d.ts', '**/*.ts', '**/*.tsx'] },
    expected: 'tsc --noEmit',
  });
  await assertTypecheckScript({
    foundation: 'owned',
    answers: { vite: true, react: true },
    tsconfig: { include: ['src/**/*.ts', 'src/**/*.tsx'] },
    expected: 'tsc --noEmit',
  });

  const assertAppSeedFrameworkVersion = async ({ foundation, frameworkPackage, seedVersion }) => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `scaffold-${foundation}-version-`));
    const workspace = new Workspace({
      targetDir: tmp,
      dryRun: false,
      backup: false,
      force: false,
    });
    await applyPackageJson({
      workspace,
      config,
      existingPackage: {
        name: `seeded-${foundation}`,
        version: '0.0.0',
        type: 'module',
        scripts: {},
        dependencies: {
          [frameworkPackage]: '^999.0.0',
        },
        devDependencies: {
          [frameworkPackage]: '^999.0.0',
        },
      },
      answers: {
        nodeProject: true,
        foundation,
        seedVersion,
        packageManager: 'keep',
        toolchainManager: 'npm',
        nodeMajor: '22',
        vite: false,
        devServer: false,
        typescript: true,
        vitest: false,
        prettier: false,
        tailwind: false,
        license: false,
      },
    });
    const written = JSON.parse(fs.readFileSync(path.join(tmp, 'package.json'), 'utf8'));
    assert.equal(written.dependencies[frameworkPackage], seedVersion);
    assert.equal(written.devDependencies?.[frameworkPackage], undefined);
  };

  await assertAppSeedFrameworkVersion({
    foundation: 'next',
    frameworkPackage: 'next',
    seedVersion: '15.0.0',
  });
  await assertAppSeedFrameworkVersion({
    foundation: 'nuxt',
    frameworkPackage: 'nuxt',
    seedVersion: '3.21.8',
  });

  const assertNuxtStructure = async ({ seedVersion, flat }) => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `scaffold-nuxt-structure-`));
    fs.mkdirSync(path.join(tmp, 'app'), { recursive: true });
    fs.mkdirSync(path.join(tmp, 'pages'), { recursive: true });
    fs.mkdirSync(path.join(tmp, 'assets'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'app.vue'), '<template />\n');
    fs.writeFileSync(path.join(tmp, 'app', 'app.vue'), '<template />\n');
    fs.writeFileSync(path.join(tmp, 'tsconfig.json'), JSON.stringify({
      files: [],
      references: [
        { path: './.nuxt/tsconfig.app.json' },
        { path: './.nuxt/tsconfig.server.json' },
      ],
    }, null, 2));
    const workspace = new Workspace({
      targetDir: tmp,
      dryRun: false,
      backup: false,
      force: false,
    });
    await applySeededFoundationOverrides({
      workspace,
      seedRun: { foundation: 'nuxt' },
      answers: {
        foundation: 'nuxt',
        seedVersion,
        typescript: true,
        tailwind: false,
        vitest: true,
      },
    });
    assert.equal(fs.existsSync(path.join(tmp, 'app.vue')), flat);
    assert.equal(fs.existsSync(path.join(tmp, 'pages', 'index.vue')), flat);
    assert.equal(fs.existsSync(path.join(tmp, 'assets', 'css', 'main.css')), flat);
    assert.equal(fs.existsSync(path.join(tmp, 'app', 'app.vue')), !flat);
    assert.equal(fs.existsSync(path.join(tmp, 'app', 'pages', 'index.vue')), !flat);
    const vitestConfig = fs.readFileSync(path.join(tmp, 'vitest.config.mts'), 'utf8');
    assert(vitestConfig.includes(flat ? "include: ['pages/**/*.test.ts']" : "include: ['app/**/*.test.ts']"));
    const tsconfig = JSON.parse(fs.readFileSync(path.join(tmp, 'tsconfig.json'), 'utf8'));
    assert.equal(tsconfig.extends, './.nuxt/tsconfig.json');
    assert.deepEqual(tsconfig.compilerOptions.types, ['node', 'vitest/globals']);
    assert.equal('files' in tsconfig, false);
    assert.equal('references' in tsconfig, false);
  };

  await assertNuxtStructure({ seedVersion: '3.21.8', flat: true });
  await assertNuxtStructure({ seedVersion: '4.4.8', flat: false });

  command = buildSeedCommand({
    answers: {
      foundation: 'nuxt',
      seedVersion: 'latest',
      install: true,
      toolchainManager: 'pnpm',
    },
    config,
    targetDir: '/tmp/scaffold-nuxt',
  });
  assert.deepEqual(command.args.slice(2), [
    'init',
    '/tmp/scaffold-nuxt',
    '--force',
    '--template',
    'minimal',
    '--packageManager',
    'pnpm',
    '--gitInit=false',
    '--no-modules',
    '--no-install',
  ]);
  assert(command.args.includes('--no-modules'));
  assert(!command.args.includes('--modules'));
  assert(command.args.includes('--packageManager'));
  assert(command.args.includes('pnpm'));
  assert(command.args.includes('--gitInit=false'));
  assert(command.args.includes('--force'));
  assert(!command.args.includes('--install'));

  command = buildSeedCommand({
    answers: {
      foundation: 'nuxt',
      seedVersion: 'latest',
      install: true,
      toolchainManager: 'pnpm',
      nuxtPreferOffline: true,
    },
    config,
    targetDir: '/tmp/scaffold-nuxt',
  });
  for (const arg of [
    '--template',
    'minimal',
    '--packageManager',
    'pnpm',
    '--gitInit=false',
    '--no-modules',
    '--preferOffline',
    '--no-install',
  ]) {
    assert(command.args.includes(arg), `missing ${arg}`);
  }

  command = buildSeedCommand({
    answers: {
      foundation: 'vue-vite',
      seedVersion: 'latest',
      typescript: true,
      jsx: true,
      router: true,
      pinia: true,
      vitest: true,
      eslint: true,
      prettier: true,
    },
    config,
    targetDir: '/tmp/scaffold-vue',
  });
  for (const arg of ['--ts', '--jsx', '--router', '--pinia', '--vitest', '--eslint', '--prettier']) {
    assert(command.args.includes(arg), `missing ${arg}`);
  }
  assert.equal(command.args[2], 'vue@latest');
  assert.equal(command.args[3], '--');
  assert.equal(command.args[command.args.length - 1], '/tmp/scaffold-vue');

  await assertViteSeedPortScripts({ foundation: 'vue-vite', react: false, vue: true });

  const assertVueSeedScriptLang = async ({ typescript, lang }) => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `scaffold-vue-lang-${lang}-`));
    fs.mkdirSync(path.join(tmp, 'src/assets'), { recursive: true });
    fs.mkdirSync(path.join(tmp, 'src/components'), { recursive: true });
    fs.mkdirSync(path.join(tmp, 'src/views'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'vite.config.ts'), "import { defineConfig } from 'vite'\nplugins: [vue()]\n");
    fs.writeFileSync(path.join(tmp, 'index.html'), '<title>Vite App</title>\n');
    fs.writeFileSync(path.join(tmp, 'src/main.ts'), "import './assets/main.css'\n");
    fs.writeFileSync(path.join(tmp, 'src/assets/main.css'), 'demo\n');
    fs.writeFileSync(path.join(tmp, 'src/components/HelloWorld.vue'), '<template />\n');
    const workspace = new Workspace({
      targetDir: tmp,
      dryRun: false,
      backup: false,
      force: false,
    });
    await applySeededFoundationOverrides({
      workspace,
      seedRun: { foundation: 'vue-vite' },
      answers: {
        foundation: 'vue-vite',
        typescript,
        tailwind: false,
        router: true,
      },
    });
    assert(fs.readFileSync(path.join(tmp, 'src/App.vue'), 'utf8').includes(`<script setup lang="${lang}">`));
    assert(fs.readFileSync(path.join(tmp, 'src/views/HomeView.vue'), 'utf8').includes(`<script setup lang="${lang}">`));
  };

  await assertVueSeedScriptLang({ typescript: false, lang: 'js' });
  await assertVueSeedScriptLang({ typescript: true, lang: 'ts' });

  assert.equal(parseArgs(['--no-feature-prompts']).featurePrompts, false);
  assert.equal(parseArgs(['--foundation', 'react-vite']).foundation, 'react-vite');
  assert.deepEqual(await resolveTypescriptAnswers(null, { typescript: true }), {
    typescript: true,
    tsMode: 'strict',
  });

  const browserCases = [
    {
      name: 'owned-react-ts',
      answers: { foundation: 'owned', typescript: true, react: true, vue: false, vite: true },
      configPath: 'vitest.config.mts',
      root: 'src',
      unitPattern: 'src/**/*.test.{ts,tsx}',
    },
    {
      name: 'owned-node-js',
      answers: { foundation: 'owned', typescript: false, react: false, vue: false, vite: false },
      configPath: 'vitest.config.mts',
      root: 'src',
      unitPattern: 'src/**/*.test.js',
    },
    {
      name: 'next-ts',
      answers: { foundation: 'next', typescript: true, react: true, vue: false, vite: false },
      configPath: 'vitest.config.mts',
      root: 'src',
      unitPattern: 'src/**/*.test.{ts,tsx}',
    },
    {
      name: 'next-js',
      answers: { foundation: 'next', typescript: false, react: true, vue: false, vite: false },
      configPath: 'vitest.config.mts',
      root: 'src',
      unitPattern: 'src/**/*.test.{js,jsx}',
    },
    {
      name: 'nuxt-3-ts',
      answers: { foundation: 'nuxt', seedVersion: '3.21.8', typescript: true, react: false, vue: true, vite: false },
      configPath: 'vitest.config.mts',
      root: 'pages',
      unitPattern: 'pages/**/*.test.ts',
    },
    {
      name: 'nuxt-4-js',
      answers: { foundation: 'nuxt', seedVersion: '4.4.8', typescript: false, react: false, vue: true, vite: false },
      configPath: 'vitest.config.mts',
      root: 'app/pages',
      unitPattern: 'app/pages/**/*.test.js',
    },
    {
      name: 'react-vite-ts',
      answers: { foundation: 'react-vite', typescript: true, react: true, vue: false, vite: true, router: true },
      configPath: 'vitest.config.mts',
      root: 'src',
      unitPattern: 'src/**/*.test.{ts,tsx}',
    },
    {
      name: 'react-vite-js',
      answers: { foundation: 'react-vite', typescript: false, react: true, vue: false, vite: true, router: false },
      configPath: 'vitest.config.mts',
      root: 'src',
      unitPattern: 'src/**/*.test.{js,jsx}',
    },
    {
      name: 'vue-vite-ts',
      answers: { foundation: 'vue-vite', typescript: true, react: false, vue: true, vite: true, router: true },
      configPath: 'vitest.config.ts',
      root: 'src',
      unitPattern: 'src/**/*.{test,spec}.ts',
    },
    {
      name: 'vue-vite-js',
      answers: { foundation: 'vue-vite', typescript: false, react: false, vue: true, vite: true, router: false },
      configPath: 'vitest.config.js',
      root: 'src',
      unitPattern: 'src/**/*.{test,spec}.js',
    },
  ];

  for (const browserCase of browserCases) {
    const target = fs.mkdtempSync(path.join(os.tmpdir(), `scaffold-browser-${browserCase.name}-`));
    const workspace = new Workspace({ targetDir: target, dryRun: false, backup: false, force: false });
    const answers = { ...browserCase.answers, vitest: true, vitestBrowser: true };
    await applyVitestBrowser(workspace, answers);
    const configText = fs.readFileSync(path.join(target, browserCase.configPath), 'utf8');
    assert(configText.includes("name: 'unit'"), browserCase.name);
    assert(configText.includes("name: 'browser'"), browserCase.name);
    assert(configText.includes('provider: playwright()'), browserCase.name);
    assert(configText.includes(`include: ['${browserCase.unitPattern}']`), browserCase.name);
    const extension = answers.typescript ? 'ts' : 'js';
    assert(fs.existsSync(path.join(target, browserCase.root, `browser.browser.test.${extension}`)));
  }

  const noBrowserTarget = fs.mkdtempSync(path.join(os.tmpdir(), 'scaffold-no-browser-'));
  const noBrowserWorkspace = new Workspace({
    targetDir: noBrowserTarget,
    dryRun: false,
    backup: false,
    force: false,
  });
  await applyVitestBrowser(noBrowserWorkspace, { vitestBrowser: false });
  assert.deepEqual(fs.readdirSync(noBrowserTarget), []);

  const actionTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'scaffold-actions-'));
  const workspace = new Workspace({
    targetDir: actionTmp,
    dryRun: false,
    backup: true,
    force: false,
  });
  fs.mkdirSync(path.join(actionTmp, 'src/keep'), { recursive: true });
  fs.writeFileSync(path.join(actionTmp, 'src/keep.txt'), 'keep\n');
  fs.writeFileSync(path.join(actionTmp, 'src/keep/nested.txt'), 'nested\n');
  fs.writeFileSync(path.join(actionTmp, 'src/keep/drop.log'), 'drop\n');
  fs.writeFileSync(path.join(actionTmp, 'src/remove.txt'), 'remove\n');
  fs.writeFileSync(path.join(actionTmp, 'src/stale.scaffold-backup'), 'backup\n');
  fs.mkdirSync(path.join(actionTmp, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(actionTmp, 'assets/base.css'), 'old base\n');
  fs.writeFileSync(path.join(actionTmp, 'assets/base.css.scaffold-backup'), 'previous backup\n');
  fs.writeFileSync(path.join(actionTmp, 'assets/logo.svg'), 'logo\n');
  fs.mkdirSync(path.join(actionTmp, 'full'), { recursive: true });
  fs.writeFileSync(path.join(actionTmp, 'full/a.txt'), 'a\n');
  fs.writeFileSync(path.join(actionTmp, 'full/b.txt'), 'b\n');
  fs.writeFileSync(path.join(actionTmp, 'app.txt'), 'alpha\nomega\n');

  await applyActions({
    workspace,
    context: { answers: { enabled: true }, values: { NAME: 'scaffold' } },
    actions: [
      {
        type: 'file.write',
        path: 'rendered.txt',
        content: 'hello {{NAME}}\n',
      },
      {
        type: 'text.insertAfter',
        path: 'app.txt',
        match: 'alpha\n',
        content: 'beta\n',
        skipIfContains: 'beta\n',
      },
      {
        type: 'json.set',
        path: 'config.json',
        create: true,
        pointer: '/compilerOptions/strict',
        value: true,
      },
      {
        type: 'json.patch',
        path: 'config.json',
        patch: [
          { op: 'add', path: '/name', value: '{{NAME}}' },
          { op: 'test', path: '/name', value: 'scaffold' }
        ],
      },
      {
        type: 'dir.clean',
        path: 'src',
        keep: ['keep.txt', { regex: '^keep/' }],
      },
      {
        type: 'file.write',
        path: 'assets/base.css',
        content: 'new base\n',
      },
      {
        type: 'dir.clean',
        path: 'assets',
        keep: ['base.css'],
      },
      {
        type: 'dir.clean',
        path: 'full',
      },
      {
        type: 'dir.clean',
        path: 'src',
        keep: ['keep.txt', 'keep/nested.txt'],
        delete: [{ regex: '\\.log$' }],
      },
    ],
  });
  assert.equal(fs.readFileSync(path.join(actionTmp, 'rendered.txt'), 'utf8'), 'hello scaffold\n');
  assert.equal(fs.readFileSync(path.join(actionTmp, 'app.txt'), 'utf8'), 'alpha\nbeta\nomega\n');
  assert.equal(JSON.parse(fs.readFileSync(path.join(actionTmp, 'config.json'), 'utf8')).name, 'scaffold');
  assert.equal(fs.existsSync(path.join(actionTmp, 'src/remove.txt')), false);
  assert.equal(fs.existsSync(path.join(actionTmp, 'src/remove.txt.scaffold-backup')), true);
  assert.equal(fs.existsSync(path.join(actionTmp, 'src/stale.scaffold-backup')), true);
  assert.equal(fs.existsSync(path.join(actionTmp, 'src/keep/nested.txt')), true);
  assert.equal(fs.existsSync(path.join(actionTmp, 'src/keep/drop.log')), false);
  assert.equal(fs.existsSync(path.join(actionTmp, 'assets/base.css.scaffold-backup')), true);
  assert.equal(fs.existsSync(path.join(actionTmp, 'assets/base.css.scaffold-backup.scaffold-backup')), false);
  assert.equal(fs.existsSync(path.join(actionTmp, 'assets/logo.svg')), false);
  assert.equal(fs.existsSync(path.join(actionTmp, 'assets/logo.svg.scaffold-backup')), true);
  assert.deepEqual(fs.readdirSync(path.join(actionTmp, 'full')), []);
  assert.equal(fs.existsSync(path.join(actionTmp, 'full.scaffold-backup/a.txt')), true);

  const noBackupTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'scaffold-no-backup-'));
  fs.writeFileSync(path.join(noBackupTmp, 'existing.txt'), 'old\n');
  const noBackupWorkspace = new Workspace({
    targetDir: noBackupTmp,
    dryRun: false,
    backup: false,
    force: false,
  });
  await applyActions({
    workspace: noBackupWorkspace,
    actions: [{ type: 'file.write', path: 'existing.txt', content: 'new\n' }],
  });
  assert.equal(fs.existsSync(path.join(noBackupTmp, 'existing.txt.scaffold-backup')), false);

  const commonTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'scaffold-common-'));
  const commonWorkspace = new Workspace({
    targetDir: commonTmp,
    dryRun: false,
    backup: true,
    force: false,
  });
  fs.writeFileSync(path.join(commonTmp, '.editorconfig'), 'root = false\nindent_size = 4\ncustom = keep\n');
  await applyActionManifest({
    workspace: commonWorkspace,
    manifestPath: 'overrides/common/defaults.json',
    context: { answers: { prettier: true, tailwind: true } },
  });
  const editorconfig = fs.readFileSync(path.join(commonTmp, '.editorconfig'), 'utf8');
  assert(editorconfig.includes('root = true'));
  assert(editorconfig.includes('indent_size = 2'));
  assert(editorconfig.includes('custom = keep'));
  assert(!fs.readFileSync(path.join(commonTmp, '.gitignore'), 'utf8').includes('/assets/'));
  assert(fs.readFileSync(path.join(commonTmp, 'prettier.config.mjs'), 'utf8').includes('prettier-plugin-tailwindcss'));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
NODE

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

bin/scaffold "$tmp/app" \
  --yes \
  --no-direnv \
  --no-flake-lock \
  --no-install \
  --git skip \
  --typescript \
  --react \
  --vitest \
  --vitest-browser \
  --license \
  --agents >/dev/null

test -f "$tmp/app/package.json"
grep -Fx '# app' "$tmp/app/README.md" >/dev/null
grep -Fx '## License' "$tmp/app/README.md" >/dev/null
test -f "$tmp/app/AGENTS.md"
test -f "$tmp/app/LICENSE"
test -f "$tmp/app/src/App.tsx"
test -f "$tmp/app/src/browser.browser.test.ts"
grep -F "provider: playwright()" "$tmp/app/vitest.config.mts" >/dev/null
grep -F 'pkgs.playwright-driver.browsers' "$tmp/app/flake.nix" >/dev/null
grep -F 'PLAYWRIGHT_BROWSERS_PATH' "$tmp/app/flake.nix" >/dev/null
node -e '
  const pkg = require(process.argv[1]);
  if (!pkg.devDependencies["@vitest/browser-playwright"] || pkg.devDependencies.playwright !== "1.59.1") {
    process.exit(1);
  }
  if (pkg.scripts["test:unit"] !== "vitest run --project unit" || pkg.scripts["test:browser"] !== "vitest run --project browser") {
    process.exit(1);
  }
  if (pkg.scripts["playwright:install"] !== "playwright install chromium") process.exit(1);
' "$tmp/app/package.json"
test -x "$tmp/app/.flake.local/bin/example"
"$tmp/app/.flake.local/bin/example" | grep -Fx "app example!" >/dev/null

bin/scaffold "$tmp/unit-only" \
  --yes \
  --no-direnv \
  --no-flake-lock \
  --no-install \
  --git skip \
  --vitest \
  --no-vitest-browser >/dev/null

test ! -e "$tmp/unit-only/src/browser.browser.test.js"
test ! -e "$tmp/unit-only/src/browser.browser.test.ts"
! grep -F "provider: playwright()" "$tmp/unit-only/vitest.config.mts" >/dev/null
! grep -F 'playwright-driver' "$tmp/unit-only/flake.nix" >/dev/null
! grep -F 'PLAYWRIGHT_BROWSERS_PATH' "$tmp/unit-only/flake.nix" >/dev/null
node -e '
  const pkg = require(process.argv[1]);
  if (pkg.devDependencies.playwright || pkg.devDependencies["@vitest/browser-playwright"]) {
    process.exit(1);
  }
' "$tmp/unit-only/package.json"

if bin/scaffold "$tmp/invalid-browser" \
  --yes \
  --no-nix \
  --no-install \
  --git skip \
  --no-vitest \
  --vitest-browser >/dev/null 2>&1
then
  echo '--vitest-browser unexpectedly accepted with --no-vitest' >&2
  exit 1
fi

if command -v git >/dev/null 2>&1; then
  mkdir -p "$tmp/replace"
  printf '{"name":"old"}\n' >"$tmp/replace/package.json"
  printf 'before\n' >"$tmp/replace/existing.txt"
  git -C "$tmp/replace" init >/dev/null
  git -C "$tmp/replace" config user.name test
  git -C "$tmp/replace" config user.email test@example.com
  git -C "$tmp/replace" add package.json existing.txt
  git -C "$tmp/replace" commit -m old >/dev/null

  bin/scaffold "$tmp/replace" \
    --yes \
    --no-nix \
    --no-agents \
    --no-license \
    --no-install \
    --git replace >/dev/null

  grep -Fx '# replace' "$tmp/replace/README.md" >/dev/null
  test "$(git -C "$tmp/replace" log --format=%s -1)" = "initial commit"
  test "$(git -C "$tmp/replace" rev-list --count HEAD)" = "1"
  git -C "$tmp/replace" ls-tree -r --name-only HEAD | grep -Fx existing.txt >/dev/null
  git -C "$tmp/replace" diff --cached --name-only | grep -Fx .editorconfig >/dev/null
  test -z "$(find "$tmp/replace" -name '*.scaffold-backup*' -print)"
fi
