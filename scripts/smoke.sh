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
  --typescript \
  --react \
  --vitest \
  --license \
  --agents >/dev/null

test -f "$tmp/app/package.json"
test -f "$tmp/app/AGENTS.md"
test -f "$tmp/app/LICENSE"
test -f "$tmp/app/src/App.tsx"

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

  test "$(git -C "$tmp/replace" log --format=%s -1)" = "initial commit"
  test "$(git -C "$tmp/replace" rev-list --count HEAD)" = "1"
  git -C "$tmp/replace" ls-tree -r --name-only HEAD | grep -Fx existing.txt >/dev/null
  git -C "$tmp/replace" diff --cached --name-only | grep -Fx .editorconfig >/dev/null
fi
