# scaffold

Personal project scaffold command.

## Run

```sh
scaffold <dir>
scaffold help
scaffold help --framework
```

The source repo lives at `~/.local/src/scaffold`. Chezmoi installs a real
wrapper at `~/.local/bin/scaffold`:

```sh
#!/usr/bin/env sh
exec node "$HOME/.local/src/scaffold/bin/scaffold" "$@"
```

Local defaults and editable base files live under `share/scaffold`.

## Choice Flow

- Missing target dir: `Y/n`
- Use nix flake: `Y/n`
- Use direnv: `Y/n` when nix is enabled
- Node project: `Y/n`
- Node version: default detected from `engines.node`, else `24`; options `26`, `24`, `22`, `20`, `18`, `16`
- Package manager: `pnpm` default; `yarn`, `npm`, and `keep detected <manager>` when available
- Prettier: `Y/n`
- Framework: `none` default; `Next.js`, `Nuxt`
- Framework version: latest npm version is printed; latest version is default
- TypeScript: `Y/n`
- TypeScript strictness: existing package defaults to `preserve`; new package defaults to `strict`
- No framework path:
  - Vite: `Y/n`
  - Dev server script: `Y/n`
  - Dev server port: `3000`
  - Vitest: `y/N`
  - React: `y/N`
  - Vue: `y/N`, only when React is no
- License: `y/N`
- License type: `AGPL-3.0-only` default
- AGENTS.md: `Y/n`
- Run nix flake lock: `Y/n` when nix is enabled
- Run package install: `y/N` when Node project is enabled
- Git: keep/init/replace/skip depending on repo state; optional remote; `git add -N` defaults on when a repo is active

Every flag has `scaffold --flag --help` and `scaffold help --flag`.

## Editable Defaults

- `share/scaffold/config/defaults.json`: versions, Node/Nix targets, package managers, framework commands, license choices
- `share/scaffold/templates/common`: dotfile defaults
- `share/scaffold/templates/nix`: flake template
- `share/scaffold/templates/agents`: AGENTS.md template
- `share/scaffold/templates/licenses`: license templates
- `share/scaffold/templates/starters`: source/config starter files

Template rendering fails if an expected token is missing or any `{{TOKEN}}`
remains unresolved.
