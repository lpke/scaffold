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

Local defaults and editable base files live under `share`.

## Choice Flow

- Missing target dir: `Y/n`
- Use nix flake: `Y/n`, skipped and enabled when flake.nix exists
- Use direnv: `Y/n` when nix is enabled; skipped and enabled when .envrc exists
- Node project: `Y/n`, skipped and enabled for existing package.json
- Node version: default detected from `engines.node`, else `24`; options `26`, `24`, `22`, `20`, `18`, `16`
- Package manager: `pnpm` default, or `keep detected <manager>` when available; `yarn`, `npm`
- TypeScript: select one of `none`, `non-strict`, `strict`; `non-strict` default
- Framework: `none` default; `Next.js`, `Nuxt`; skipped for existing package unless `--framework` is provided
- Framework version: highest semver, latest tag (default), or specify version; custom input shows highest versions by recent majors
- Prettier: selected by default in feature prompts
- No framework path:
  - Feature multiselect: Prettier, Vite, React, Vue, Tailwind, Vitest; Prettier defaults on
  - Vite includes dev server scripts by default
  - Dev server port: `3000`, prompted when dev server scripts will be added
  - React and Vue are mutually exclusive; selecting both asks which starter to keep
  - Tailwind implies Vite; local Vite starters install Tailwind CSS and wire the Vite plugin/CSS entry; with Prettier, installs and configures the Tailwind Prettier plugin in `prettier.config.mjs`
- Framework path:
  - Feature multiselect: Prettier, Tailwind; Prettier defaults on; Next.js passes `--tailwind` or `--no-tailwind`
- License: `y/N`
- License type: `AGPL-3.0-only` default
- AGENTS.md: `y/N`
- Run nix flake lock: `Y/n` when nix is enabled
- Run package install: `y/N` when Node project is enabled
- Git: defaults to skip in interactive mode; replace mode commits the pre-scaffold state as `initial commit`; optional remote with `main` tracking config; Nix projects stage before Nix commands; `git add --all -- .` defaults on when a repo is active at the end

Every flag has `scaffold --flag --help` and `scaffold help --flag`.

## Editable Defaults

- `share/config.json`: versions, Node/Nix targets, package managers, framework commands, license choices
- `share/templates/common`: dotfile defaults
- `share/templates/nix`: flake template
- `share/templates/agents`: AGENTS.md template
- `share/templates/licenses`: license templates
- `share/templates/starters`: source/config starter files

Template rendering fails if an expected token is missing or any `{{TOKEN}}`
remains unresolved.
