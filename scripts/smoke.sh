#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

find src -name '*.js' -print -exec node --check {} \;
node --check bin/scaffold

test -f share/config.json
test -d share/templates
test ! -e share/scaffold

bin/scaffold --help >/dev/null
bin/scaffold help --framework >/dev/null

for flag in \
  --yes --dry-run --nix --no-nix --direnv --no-direnv \
  --node-project --no-node-project --node --package-manager \
  --prettier --no-prettier --tailwind --no-tailwind --framework \
  --frontend-base --framework-version --typescript --no-typescript --strict \
  --nuxt-offline --nuxt-prefer-offline \
  --non-strict --preserve-ts --vite --no-vite --no-libraries --dev-server \
  --no-dev-server --dev-port --vitest --no-vitest --react \
  --no-react --vue --no-vue --jsx --no-jsx --router --no-router \
  --pinia --no-pinia --eslint --no-eslint --linter --no-linter \
  --license --no-license --license-type \
  --agents --no-agents --flake-lock --no-flake-lock --install \
  --no-install --git --git-remote --git-remote-name --git-add \
  --no-git-add --force --backup --no-backup
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
const { frameworkCommand, frontendBaseCommand } = require('./src/frameworks');
const { resolveTypescriptAnswers } = require('./src/prompt-features');
const { Workspace } = require('./src/workspace');
const { applyActionManifest, applyActions } = require('./src/helpers/actions');

(async () => {
  const config = await loadConfig();
  const baseAnswers = {
    framework: 'next',
    frameworkVersion: '15.0.0',
    install: false,
    toolchainManager: 'pnpm',
  };

  let command = frameworkCommand({
    answers: { ...baseAnswers, tailwind: true, typescript: true },
    config,
    targetDir: '/tmp/scaffold-next',
  });
  for (const arg of ['--ts', '--eslint', '--react-compiler', '--tailwind', '--no-agents-md']) {
    assert(command.args.includes(arg), `missing ${arg}`);
  }
  assert(!command.args.includes('--typescript'));

  command = frameworkCommand({
    answers: { ...baseAnswers, tailwind: false, typescript: false },
    config,
    targetDir: '/tmp/scaffold-next',
  });
  assert(command.args.includes('--js'));
  assert(command.args.includes('--no-tailwind'));
  assert(!command.args.includes('--javascript'));

  command = frontendBaseCommand({
    answers: { frontendBase: 'react', typescript: true, router: true },
    targetDir: '/tmp/scaffold-react',
  });
  assert.deepEqual(command.args.slice(-4), ['--', '--template', 'react-ts', '--no-interactive']);
  assert.equal(parseArgs(['--frontend-base', 'react', '--router']).router, true);

  command = frameworkCommand({
    answers: {
      framework: 'nuxt',
      frameworkVersion: 'latest',
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

  command = frameworkCommand({
    answers: {
      framework: 'nuxt',
      frameworkVersion: 'latest',
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

  command = frontendBaseCommand({
    answers: {
      frontendBase: 'vue',
      typescript: true,
      jsx: true,
      router: true,
      pinia: true,
      vitest: true,
      eslint: true,
      prettier: true,
    },
    targetDir: '/tmp/scaffold-vue',
  });
  for (const arg of ['--ts', '--jsx', '--router', '--pinia', '--vitest', '--eslint', '--prettier']) {
    assert(command.args.includes(arg), `missing ${arg}`);
  }
  assert.equal(command.args[2], '--');
  assert.equal(command.args[command.args.length - 1], '/tmp/scaffold-vue');

  assert.equal(parseArgs(['--no-libraries']).libraries, false);
  assert.equal(parseArgs(['--frontend-base', 'react']).frontendBase, 'react');
  assert.deepEqual(await resolveTypescriptAnswers(null, { typescript: true }), {
    typescript: true,
    tsMode: 'strict',
  });

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
  assert(fs.readFileSync(path.join(commonTmp, '.gitignore'), 'utf8').includes('/assets/'));
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
  --license \
  --agents >/dev/null

test -f "$tmp/app/package.json"
grep -Fx '# app' "$tmp/app/README.md" >/dev/null
grep -Fx '## License' "$tmp/app/README.md" >/dev/null
test -f "$tmp/app/AGENTS.md"
test -f "$tmp/app/LICENSE"
test -f "$tmp/app/src/App.tsx"
test -x "$tmp/app/.flake.local/bin/example"
"$tmp/app/.flake.local/bin/example" | grep -Fx "app example!" >/dev/null

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
