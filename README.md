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
- TypeScript: select one of `none`, `non-strict`, `strict`; `strict` default
- Framework: `none` default; `Next.js (React)`, `Nuxt (Vue)`; skipped for existing package unless `--framework` is provided
- Framework version: highest semver, latest tag (default), or specify version; custom input shows highest versions by recent majors
- Frontend base: after `Framework: none`, choose `none`, `React`, or `Vue`; default `none`
- Prettier: selected by default in feature prompts
- When Prettier is selected, scaffold runs `prettier --write .` after generation/install and stages the formatted result
- No framework path:
  - With `Frontend base: none`, feature multiselect: Prettier, Vite barebones, React barebones, Vue barebones, Tailwind, Vitest; Prettier defaults on
  - With `Frontend base: React`, scaffold first runs `npm create vite@latest <dir> -- --template react-ts --no-interactive` for TypeScript, or `react` for JavaScript; optional `--router` adds React Router on top
  - With `Frontend base: Vue`, scaffold first runs `npm create vue@latest <dir> -- --ts/--jsx/--router/--pinia/--vitest/--eslint/--prettier` based on selected features, or `--default` when no create-vue feature flags are selected
  - Command-based base scaffolds are committed first as `base scaffold from <command>`; scaffold preferences are applied after and left staged
  - React frontend base feature choices add React Router; Vue frontend base feature choices add JSX support, Vue Router, Pinia, and Linter
  - Vite includes dev server scripts by default
  - Dev server port: `3000`, prompted when dev server scripts will be added
  - React and Vue are mutually exclusive; selecting both asks which starter to keep
  - Tailwind implies Vite; local Vite starters install Tailwind CSS and wire the Vite plugin/CSS entry; with Prettier, installs and configures the Tailwind Prettier plugin in `prettier.config.mjs`
- Framework path:
  - Feature multiselect: Prettier, Tailwind; Prettier defaults on; Next.js passes `--tailwind` or `--no-tailwind`
  - Nuxt uses `--force --template minimal --packageManager <selected> --gitInit=false --no-modules --no-install`; optional offline/prefer-offline flags are passed through, and scaffold handles git/install afterward
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
- `share/overrides`: declarative post-generator action manifests
- `share/templates/overrides`: larger file bodies used by override manifests

Template rendering fails if an expected token is missing or any `{{TOKEN}}`
remains unresolved.
