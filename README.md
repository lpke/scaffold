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
- Use nix flake: `y/N`
- Use direnv: `y/N` when nix is enabled
- Node project: `y/N`, skipped and enabled for existing package.json
- Node version: default detected from `engines.node`, else `24`; options `26`, `24`, `22`, `20`, `18`, `16`
- Package manager: `pnpm` default, or `keep detected <manager>` when available; `yarn`, `npm`
- Prettier: `y/N`
- Framework: `none` default; `Next.js`, `Nuxt`; skipped for existing package unless `--framework` is provided
- Framework version: latest npm version is printed; latest version is default
- TypeScript: `y/N`
- TypeScript strictness: existing package defaults to `preserve`; new package defaults to `strict`
- No framework path:
  - Vite: `y/N`
  - Dev server script: `y/N`
  - Dev server port: `3000`
  - Vitest: `y/N`
  - React: `y/N`
  - Vue: `y/N`, only when React is no
- License: `y/N`
- License type: `AGPL-3.0-only` default
- AGENTS.md: `y/N`
- Run nix flake lock: `Y/n` when nix is enabled
- Run package install: `y/N` when Node project is enabled
- Git: defaults to skip in interactive mode; replace mode commits the pre-scaffold state as `initial commit`; optional remote with `main` tracking config; `git add --all -- .` defaults on when a repo is active, before Nix flake commands and again at the end
- cd to scaffolded dir: `y/N` when target differs from current dir; opens a shell there unless shell integration handles a real cd

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
