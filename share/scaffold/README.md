# scaffold

Personal Node project setup command managed by chezmoi.

## Use

```sh
scaffold <dir>
```

Running `scaffold` with no arguments prints help. Use `scaffold help` for the
same top-level help, or `scaffold help --profile` for per-flag help.

Defaults follow current local project patterns:

- pnpm
- Nix flake with `.envrc`
- `.editorconfig`
- Prettier with single quotes
- TypeScript starter profiles
- `format` and `format:all` scripts
- one-time `*.scaffold-backup` files before overwrites

## Profiles

- `config`: patch an existing repo without adding app source files
- `node`: bare TypeScript Node starter
- `node-vitest`: TypeScript Node starter with Vitest
- `vite-react`: Vite React starter

Non-interactive example:

```sh
scaffold ~/Documents/lpdev/new-tool --yes --profile node --no-install
```

Dry-run an existing repo:

```sh
scaffold . --dry-run
```
