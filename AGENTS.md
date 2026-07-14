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
  - **feature pass:** Applies selected answers such as TypeScript, Tailwind, Vitest, router, React, Vue, or tooling features.
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
- For seeded foundations, apply seeded-foundation override manifests to reshape seed output.
- Run final steps such as install, format, Nix, and git handling when selected.

**Answers, templates, common defaults, features, and overrides stack. They are not mutually exclusive.**

## Scaffold Change Philosophy

When a request affects generated project structure, do not apply the user's snippet literally to every path. Treat snippets as intent examples, then map that intent onto each scaffold shape.

For every cross-project change, consider and validate each distinct path:

- owned foundations vs seeded foundations
- fresh mode vs overlay mode when relevant
- Next.js, Nuxt, React Vite, Vue Vite, vanilla Vite, React/Vue without Vite, and Node-only shapes
- TypeScript vs JavaScript output
- Tailwind vs no Tailwind
- Vitest/router/feature combinations that change files, dirs, configs, or imports

Seeded foundations should stay close to the seed output unless the request explicitly asks to replace or delete seed structure. Prefer small, deterministic overrides that adapt after inspecting the seed layout. If a framework has its own convention or generated config path, use that convention instead of forcing a shared shape. Examples: preserve existing Next alias preferences, use Nuxt `nuxt.config.ts` conventions for Nuxt aliases when appropriate, and prefer `tsconfig.app.json` over `tsconfig.json` in Vite seeds when that is the generated TypeScript app config.

For path, alias, config, styles, or directory changes:

- inspect relevant templates, seeded override manifests, common defaults, and feature code before editing
- choose paths from actual generated layout; for dry-run or pre-seed reasoning, use the seed's expected default layout
- create referenced directories only when they belong to that scaffold shape
- avoid adding React-specific structure to Vue/Nuxt/vanilla/Node outputs, and avoid adding app-specific structure to bare-bones templates unless requested
- preserve existing aliases or framework defaults unless the request explicitly says to replace them
- if deleting/replacing seed folders, replace them with the requested structure intentionally and keep the result clean
- validate by simulating representative scaffold commands in a temporary directory, including at least one negative/control case where the change should not appear

Always visualize the final generated tree before finishing. The result should evolve scaffold's conventions without making unrelated seed output feel heavily rewritten.

## Adding Answer-Backed Features

Trace every selectable feature through each applicable layer. Do not stop after adding a prompt or template.

- CLI help, positive/negative flags, parsing, inference, and contradictory-flag validation
- interactive prompt ordering, remembered answers, back navigation, and non-interactive defaults
- the `nodeProject: false` fallback answer set
- owned foundations and all seeded foundations
- fresh and overlay modes where relevant
- TypeScript and JavaScript, plus framework/router/style combinations that affect output
- dependencies, scripts, configs, templates, overrides, Nix, README, and generated AGENTS.md tech lines
- smoke coverage, a disabled-feature control, generated-tree inspection, and representative runtime checks

Positive flags may imply prerequisites when that is unambiguous. An explicit contradictory negative flag must produce a clear error. If a feature is disabled, preserve existing output and avoid feature-specific files, packages, scripts, and Nix configuration.

## Choosing The Right Pass

- Use owned templates for scaffold-controlled starting files.
- Use override manifests for deterministic, foundation-specific changes to seed output.
- Use a focused JavaScript pass when behavior is shared across foundations or needs computed paths, filesystem inspection, or non-trivial generation.
- Apply a cross-foundation pass after the files it depends on exist and before package/final setup that consumes its answers.
- Avoid generating a scaffold-owned file in one pass only to overwrite it in a later pass. Gate the earlier writer instead.
- Keep feature logic together where practical; do not spread equivalent config bodies across manifests and source without a clear ownership boundary.

## Prompts, Flags, And Merges

- Ask dependent questions only after their prerequisite is selected. Every interactive choice needs an equivalent non-interactive flag.
- Add new answer keys to prompt invalidation/backtracking and explicit false-answer paths.
- Preserve existing package scripts and dependencies by default. Intentionally replace a value only when selected behavior requires an exact command or configuration.
- Treat overlay files as user-owned. Follow existing overwrite, force, and backup behavior; do not silently replace unrelated configuration.
- Keep package versions in `share/config.json`. When two ecosystems must match exactly, encode and validate that invariant rather than relying on compatible-looking ranges.

## Minimum Verification

For cross-project changes, verify at least:

- owned JavaScript and TypeScript paths
- every affected seeded foundation, including version-dependent layouts
- one enabled case and one disabled/control case
- CLI help, positive/negative flags, implication rules, and conflict errors
- generated package/config/Nix contents and final tree shape
- one real install and runtime check for the highest-risk path
- `npm run check`, `npm run smoke`, and `git diff --check`

Prefer fast direct tests for the full option matrix, then use a smaller number of live seed/install tests to catch upstream generator and runtime integration differences.

## Seeded Project Paths

For seeded foundations, inspect the generated root layout before choosing paths for feature files or overrides. Prefer existing root-level `src/` or `app/` directories instead of assuming a top-level path; in dry-run paths, use the seed foundation's expected default layout.

- Next.js uses `_types` directories: `src/app/_types` when `src/app/` exists, otherwise `src/_types` when only `src/` exists.
- Nuxt app-directory projects put shared types under `app/types`.
- React/Vue Vite seeds usually put shared types under `src/types` when `src/` exists.

## Config Locations

- `share/config.json`: package versions, Node/Nix targets, package managers, foundation seed commands, and license choices.
- `share/templates/owned`: owned foundation templates.
- `share/templates/seeded`: file bodies used by seeded-foundation override manifests.
- `share/templates/shared`: reusable project pieces such as common dotfiles, Nix, AGENTS.md, licenses, and TypeScript configs.
- `share/overrides/common/defaults.json`: common defaults action manifest.
- `share/overrides/foundations`: seeded-foundation override manifests.
- `src/helpers/actions`: action engine implementation.
