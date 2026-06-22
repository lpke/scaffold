# scaffold

`scaffold` creates a new project or updates an existing one from the same set of
local defaults. You can answer prompts interactively, or pass flags for a
repeatable run.

The tool works in three layers:

1. It inspects the target directory.
2. It creates or uses a foundation.
3. It applies passes that add defaults, selected features, overrides, and final setup.

## Running

```sh
scaffold <target>
scaffold . --dry-run
scaffold help
scaffold help --foundation
```

The source repo lives at `~/.local/src/scaffold`. Chezmoi installs the command
wrapper at `~/.local/bin/scaffold`.

## How It Thinks

The target is the directory passed to `scaffold <target>`. It can be missing,
empty, or already contain a project.

The mode describes the target before scaffold changes it:

- `fresh`: the target is new or empty.
- `overlay`: the target already has files and scaffold will add or merge changes.

The foundation is the starting project shape:

- `owned`: scaffold copies local templates from `share/templates/owned`.
- `next`: scaffold runs create-next-app, then applies scaffold overrides.
- `nuxt`: scaffold runs Nuxt init, then applies scaffold overrides.
- `react-vite`: scaffold runs create-vite, then applies scaffold overrides.
- `vue-vite`: scaffold runs create-vue, then applies scaffold overrides.

Passes are the phases after answers are resolved. A seeded foundation starts
with a seed pass; an owned foundation starts with a template pass. Then scaffold
applies common defaults, selected features, seeded overrides where needed, and
final setup such as README, license, AGENTS.md, install, format, Nix, and git.

Answers, templates, defaults, features, and overrides stack. They are not
exclusive choices.

## Common Flows

Fresh owned scaffold:

```sh
scaffold my-tool --foundation owned
```

Fresh seeded scaffold:

```sh
scaffold my-app --foundation react-vite
scaffold my-site --foundation next
```

Overlay an existing project:

```sh
scaffold . --dry-run
scaffold . --foundation owned
```

Use `--dry-run` first when you want to inspect planned file changes and commands.

## Main Choices

- Nix and direnv support
- Node version and package manager
- TypeScript mode: none, non-strict, strict, or preserve existing tsconfig
- Foundation and seed version
- Features such as Prettier, Tailwind, Vitest, React, Vue, router, Pinia, and ESLint
- License and AGENTS.md generation
- Install, format, flake lock, and git handling

Every flag supports help:

```sh
scaffold --foundation --help
scaffold help --seed-version
```

## Project Files

`share/config.json`
: Versions, Node/Nix targets, package managers, seed commands, and license choices.

`share/templates/owned`
: Starting files for the owned foundation.

`share/templates/seeded`
: File bodies used by seeded-foundation override manifests.

`share/templates/shared`
: Reusable project pieces such as common dotfiles, Nix files, AGENTS.md, licenses, and TypeScript configs.

`share/overrides/common/defaults.json`
: Common defaults applied across projects.

`share/overrides/foundations`
: Override manifests applied after seeded foundations.

`src/helpers/actions`
: The action engine used by common defaults and seeded-foundation overrides.

Template rendering fails if an expected token is missing or any `{{TOKEN}}`
remains unresolved.
