# scaffold

This interactive CLI tool helps the user create or update projects by answering prompts or passing flags. Under the hood, scaffold first determines the **Mode** from the target state, then creates or uses a **Foundation**, then applies **Passes** that add scaffold defaults, features, overrides, and final project setup.

## Terms

- **Target:** Project directory passed to `scaffold <target>`. Can be an existing project dir, an empty dir, or a dir that hasn't been created yet.

- **Mode:** Target state before scaffold acts.
  - **fresh:** Target is empty or needs to be newly created (clean slate).
  - **overlay:** Target already has files (existing project to be edited).

- **Foundation:** Starting point that scaffold either provides (owned) or generates with a seed command (seeded).
  - **owned foundation:** Scaffold-owned templates/assets, such as files under `share/templates`.
  - **seeded foundation:** External seed command output, such as output from `create-vite`, `create-vue`, `create-next-app`, or `nuxt init`.

- **Pass:** Change phase applied to the target/foundation.
  - **seed pass:** Runs the external seed command.
  - **template pass:** Copies or renders scaffold-owned files.
  - **defaults pass:** Applies shared scaffold defaults.
  - **feature pass:** Applies selected answers such as TypeScript, Tailwind, Vitest, router, framework, or frontend base.
  - **override pass:** Applies declarative file, text, JSON, or directory actions.
  - **final pass:** Runs final install, format, git, Nix, README, license, or AGENTS steps.

- **Examples:**
  - **fresh owned scaffold**
  - **overlay owned scaffold**
  - **fresh seeded scaffold**

- **Seed command:** External generator command used by a seeded foundation.
- **Seed output:** Raw files produced by the seed command before scaffold passes.
- **Answers:** Resolved user selections from prompts or flags.
- **Features:** User-facing optional answers that add tooling, libraries, files, scripts, or config.
- **Common defaults:** Shared scaffold changes applied across project types, regardless of foundation where applicable.
- **Templates:** Local scaffold-owned files copied or rendered into generated projects.
- **Overrides:** Declarative file, text, JSON, or directory actions used by override passes.
- **Action engine:** Code that runs declarative action manifests. It is used for common defaults and seeded-foundation overrides.

## Answers And Project Changes

Scaffold resolves answers first, before it writes project files. Answers come from prompts and flags, then drive the rest of the run.

The usual order is:

- Decide the target and mode.
- Decide the foundation.
- For a seeded foundation, build seed-command flags from answers and run the seed command.
- For an owned foundation, copy or render scaffold-owned templates.
- Apply common defaults.
- Apply selected features: package dependencies, scripts, TypeScript config, Vite files, tests, README/license/AGENTS files, and similar project pieces.
- For seeded foundations, apply framework/frontend override manifests to reshape seed output.
- Run final steps such as install, format, Nix, and git handling when selected.

**Answers, templates, common defaults, features, and overrides stack. They are not mutually exclusive.**

## Config Locations

- `share/config.json`: package versions, Node/Nix targets, package managers, framework seed commands, and license choices.
- `share/templates`: scaffold-owned template files.
- `share/overrides`: action manifests for common defaults and seeded-foundation overrides.
- `share/templates/overrides`: larger file bodies used by override manifests.
- `src/helpers/actions`: action engine implementation.
