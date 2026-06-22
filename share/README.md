# scaffold assets

Editable defaults, templates, and override manifests for `scaffold`.

Start with `config.json` for preference changes.

Template roots:

- `templates/owned/`: starting files for the owned foundation.
- `templates/seeded/`: file bodies referenced by seeded-foundation override manifests.
- `templates/shared/`: reusable project pieces such as common dotfiles, Nix, AGENTS.md, licenses, and TypeScript configs.

Defaults and seeded-foundation override passes live in `overrides/`. Each JSON
file is an action manifest.
