#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

find src -name '*.js' -print -exec node --check {} \;
node --check bin/scaffold

bin/scaffold --help >/dev/null
bin/scaffold help --framework >/dev/null

for flag in \
  --yes --dry-run --nix --no-nix --direnv --no-direnv \
  --node-project --no-node-project --node --package-manager \
  --prettier --no-prettier --tailwind-prettier --framework \
  --framework-version --typescript --no-typescript --strict \
  --non-strict --preserve-ts --vite --no-vite --dev-server \
  --no-dev-server --dev-port --vitest --no-vitest --react \
  --no-react --vue --no-vue --license --no-license --license-type \
  --agents --no-agents --flake-lock --no-flake-lock --install \
  --no-install --git --git-remote --git-remote-name --git-add \
  --no-git-add --force --backup --no-backup
do
  bin/scaffold "$flag" --help >/dev/null
  bin/scaffold help "$flag" >/dev/null
done

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

bin/scaffold "$tmp/app" \
  --yes \
  --no-direnv \
  --no-flake-lock \
  --no-install \
  --git skip \
  --react \
  --vitest \
  --license \
  --agents >/dev/null

test -f "$tmp/app/package.json"
test -f "$tmp/app/AGENTS.md"
test -f "$tmp/app/LICENSE"
test -f "$tmp/app/src/App.tsx"
