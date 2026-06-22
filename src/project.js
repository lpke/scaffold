'use strict';

const path = require('node:path');

const { commandVersion } = require('./commands');
const { readAsset, renderAsset } = require('./assets');
const { fileExists, readText } = require('./detect');
const {
  foundationLabel,
  isAppSeed,
  isNextFoundation,
  isNuxtFoundation,
  isOwnedFoundation,
  isSeededFoundation,
  isViteSeed,
} = require('./foundations');
const { applyActionManifest } = require('./helpers/actions');
const { parseJson } = require('./json');
const { formatJson } = require('./json-format');

const NON_STRICT_TS = {
  strict: false,
  noImplicitAny: false,
  noImplicitThis: false,
  strictNullChecks: false,
  strictFunctionTypes: false,
  strictBindCallApply: false,
  strictPropertyInitialization: false,
  exactOptionalPropertyTypes: false,
  noUncheckedIndexedAccess: false,
};

const STRICT_TS = {
  strict: true,
  isolatedModules: true,
  esModuleInterop: true,
  skipLibCheck: true,
};

const sanitizePackageName = (dirPath) => {
  const name = path.basename(path.resolve(dirPath));
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'node-app'
  );
};

const mergeObjectDefaults = (target, defaults, { overwrite = false } = {}) => {
  for (const [key, value] of Object.entries(defaults)) {
    if (overwrite || target[key] == null) {
      target[key] = value;
    }
  }
};

const getPackageManagerVersion = (manager, config) =>
  commandVersion(manager, config.packageManagers[manager].defaultVersion);

const applyPackageManager = (pkg, selection, toolchainManager, config) => {
  if (selection === 'keep') {
    return;
  }
  const version = getPackageManagerVersion(toolchainManager, config);
  pkg.packageManager = `${toolchainManager}@${version}`;
  pkg.engines ??= {};
  pkg.engines[toolchainManager] = config.packageManagers[toolchainManager].engine;

  for (const manager of Object.keys(config.packageManagers)) {
    if (manager !== toolchainManager) {
      delete pkg.engines[manager];
    }
  }
};

const dependencySet = (answers, config) => {
  const deps = {};
  const devDeps = {};
  const addDep = (name) => {
    deps[name] = config.versions[name];
  };
  const addDev = (name) => {
    devDeps[name] = config.versions[name];
  };

  if (answers.prettier) {
    addDev('prettier');
    if (answers.tailwind) {
      addDev('prettier-plugin-tailwindcss');
    }
  }

  if (answers.tailwind && answers.vite) {
    addDev('@tailwindcss/vite');
    addDev('tailwindcss');
  }

  if (isAppSeed(answers.foundation)) {
    if (isNuxtFoundation(answers.foundation) && answers.tailwind) {
      addDev('@tailwindcss/vite');
      addDev('tailwindcss');
    }
    if (answers.vitest) {
      addDev('vitest');
      if (isNextFoundation(answers.foundation)) {
        addDev('@vitejs/plugin-react');
      }
      if (isNuxtFoundation(answers.foundation)) {
        addDev('@vitejs/plugin-vue');
        addDev('jsdom');
      }
    }
    if (answers.typescript) {
      addDev('typescript');
      addDev('@types/node');
    }
    return { deps, devDeps };
  }

  if (answers.typescript) {
    addDev('typescript');
    addDev('@types/node');
    if (!answers.vite) {
      addDev('tsx');
    }
  }

  if (answers.vite) {
    addDev('vite');
    if (answers.react) {
      addDep('react');
      addDep('react-dom');
      if (answers.router) {
        addDep('react-router');
      }
      addDev('@vitejs/plugin-react');
      addDev('@types/react');
      addDev('@types/react-dom');
    }
    if (answers.vue) {
      addDep('vue');
      addDev('@vitejs/plugin-vue');
    }
  } else {
    if (answers.react) {
      addDep('react');
      addDep('react-dom');
      if (answers.router) {
        addDep('react-router');
      }
      addDev('@types/react');
      addDev('@types/react-dom');
    }
    if (answers.vue) {
      addDep('vue');
    }
  }

  if (answers.vitest) {
    addDev('vitest');
    if (answers.vite || answers.react || answers.vue) {
      addDev('jsdom');
      if (answers.react) {
        addDev('@vitejs/plugin-react');
        addDev('@testing-library/jest-dom');
        addDev('@testing-library/react');
        addDev('@testing-library/user-event');
      }
      if (answers.vue) {
        addDev('@vitejs/plugin-vue');
      }
    }
  }

  return { deps, devDeps };
};

const scriptSet = (answers) => {
  const scripts = {};

  if (answers.prettier) {
    scripts.format = 'prettier --write';
    scripts['format:all'] = 'prettier --write .';
  }

  if (!answers.nodeProject) {
    return scripts;
  }

  if (isAppSeed(answers.foundation)) {
    if (answers.typescript) {
      scripts.typecheck = 'tsc --noEmit';
    }
    if (answers.vitest) {
      scripts.test = 'vitest run';
      scripts['test:watch'] = 'vitest';
    }
    return scripts;
  }

  if (answers.vite) {
    if (answers.devServer) {
      scripts.dev = `vite --host 0.0.0.0 --port ${answers.devPort}`;
      scripts['dev:nohost'] = `vite --port ${answers.devPort}`;
      scripts.preview = `vite preview --host 0.0.0.0 --port ${answers.devPort}`;
      scripts['preview:nohost'] = `vite preview --port ${answers.devPort}`;
    }
    scripts.build = 'vite build';
    if (answers.typescript) {
      scripts.typecheck = 'tsc --noEmit';
    }
  } else if (answers.typescript) {
    scripts.typecheck = 'tsc --noEmit';
    scripts.build = 'tsc';
  }

  if (answers.vitest) {
    scripts.test = 'vitest run';
    scripts['test:watch'] = 'vitest';
  }

  return scripts;
};

const viteProjectTitle = (answers) => {
  if (answers.react) return 'React + Vite';
  if (answers.vue) return 'Vue + Vite';
  return 'Vite';
};

const vitestPluginConfig = (answers) => {
  if (answers.react) {
    return {
      import: "import react from '@vitejs/plugin-react';\n",
      block: '  plugins: [react()],\n',
    };
  }
  if (answers.vue) {
    return {
      import: "import vue from '@vitejs/plugin-vue';\n",
      block: '  plugins: [vue()],\n',
    };
  }
  return { import: '', block: '' };
};

const applyPackageJson = async ({ workspace, answers, existingPackage, config }) => {
  if (!answers.nodeProject) {
    return;
  }

  const nodeConfig = config.nodeTargets[answers.nodeMajor];
  const creating = !existingPackage;
  const pkg =
    existingPackage ??
    {
      name: sanitizePackageName(workspace.targetDir),
      version: '1.0.0',
      author: config.author,
      type: 'module',
      engines: {},
      scripts: {},
      devDependencies: {},
    };

  pkg.engines ??= {};
  pkg.engines.node = nodeConfig.engine;
  applyPackageManager(pkg, answers.packageManager, answers.toolchainManager, config);

  if (creating && isOwnedFoundation(answers.foundation)) {
    pkg.type ??= 'module';
  }

  if (answers.license && answers.licenseType !== 'UNLICENSED') {
    pkg.license = answers.licenseType;
  } else if (answers.licenseType === 'UNLICENSED') {
    pkg.license = 'UNLICENSED';
  }

  pkg.scripts ??= {};
  const scripts = scriptSet(answers);
  mergeObjectDefaults(pkg.scripts, scripts);
  if (
    (isOwnedFoundation(answers.foundation) || isViteSeed(answers.foundation)) &&
    answers.vite &&
    answers.devServer
  ) {
    for (const name of ['dev', 'dev:nohost', 'preview', 'preview:nohost']) {
      pkg.scripts[name] = scripts[name];
    }
  }

  const { deps, devDeps } = dependencySet(answers, config);
  if (Object.keys(deps).length > 0) {
    pkg.dependencies ??= {};
    mergeObjectDefaults(pkg.dependencies, deps);
  }
  if (Object.keys(devDeps).length > 0) {
    pkg.devDependencies ??= {};
    mergeObjectDefaults(pkg.devDependencies, devDeps);
  }

  await workspace.write('package.json', `${JSON.stringify(pkg, null, 2)}\n`);
};

const renderPackageList = (answers, config) => {
  const packages = [];
  if (answers.nodeProject) {
    const nodeConfig = config.nodeTargets[answers.nodeMajor];
    packages.push(`pkgs.${nodeConfig.nodePackage}`);
    const manager = config.packageManagers[answers.toolchainManager];
    if (manager.nixPackage) {
      packages.push(manager.nixPackage.replace('${nodePackage}', nodeConfig.nodePackage));
    }
  }
  return packages.map((pkg) => `            ${pkg}`).join('\n');
};

const renderNixpkgsConfig = (nodeConfig) => {
  const permitted = nodeConfig.permittedInsecurePackages ?? [];
  if (permitted.length === 0) {
    return '';
  }
  const packages = permitted.map((pkg) => `              "${pkg}"`).join('\n');
  return `
          config = {
            permittedInsecurePackages = [
${packages}
            ];
          };`;
};

const applyNix = async ({ workspace, answers, config }) => {
  if (!answers.nix) {
    return;
  }
  const nodeConfig = config.nodeTargets[answers.nodeMajor] ?? config.nodeTargets['24'];
  const flake = await renderAsset('templates/shared/nix/flake.nix.tmpl', {
    PROJECT_NAME: sanitizePackageName(workspace.targetDir),
    NIXPKGS: nodeConfig.nixpkgs,
    NIXPKGS_CONFIG: renderNixpkgsConfig(nodeConfig),
    PACKAGES: renderPackageList(answers, config),
  });
  await workspace.write('flake.nix', flake);
  await workspace.write(
    '.flake.local/bin/example',
    await renderAsset('templates/shared/nix/flake.local/bin/example', {
      PROJECT_NAME: sanitizePackageName(workspace.targetDir),
    }),
    { mode: 0o755 },
  );
  if (answers.direnv) {
    await workspace.copyTemplate('shared/nix/.envrc', '.envrc', { overwrite: false });
  }
};

const applyCommon = async ({ workspace, answers }) => {
  await applyActionManifest({
    workspace,
    manifestPath: 'overrides/common/defaults.json',
    context: { answers },
  });
};

const applyTsMode = async (workspace, mode) => {
  const tsconfigPath = workspace.targetPath('tsconfig.json');
  if (!(await fileExists(tsconfigPath))) {
    return;
  }
  if (mode === 'preserve') {
    workspace.skipped.push('tsconfig strictness preserved');
    return;
  }
  const tsconfig = parseJson(await readAssetFromTarget(tsconfigPath), tsconfigPath);
  tsconfig.compilerOptions ??= {};
  mergeObjectDefaults(tsconfig.compilerOptions, mode === 'strict' ? STRICT_TS : NON_STRICT_TS, {
    overwrite: true,
  });
  await workspace.write('tsconfig.json', formatJson(tsconfig));
};

const readAssetFromTarget = async (filePath) => {
  const fs = require('node:fs/promises');
  return fs.readFile(filePath, 'utf8');
};

const renderLicense = async (template, config) => {
  let text = await readAsset(`templates/${template}`);
  text = text.split('{{YEAR}}').join(String(new Date().getFullYear()));
  text = text.split('{{AUTHOR}}').join(config.author);
  return text;
};

const licenseReadmeSentence = (licenseType) => {
  const sentences = {
    'AGPL-3.0-only':
      'This project is licensed under the GNU Affero General Public License v3.0 only. Full text: [LICENSE](./LICENSE).',
    'Apache-2.0':
      'This project is licensed under the Apache License, Version 2.0. Full text: [LICENSE](./LICENSE).',
    'GPL-3.0-only':
      'This project is licensed under the GNU General Public License v3.0 only. Full text: [LICENSE](./LICENSE).',
    MIT: 'This project is licensed under the MIT License. Full text: [LICENSE](./LICENSE).',
    UNLICENSED: 'This project is unlicensed. No permission is granted for reuse unless stated otherwise.',
  };
  return sentences[licenseType] ?? `This project is licensed under ${licenseType}. Full text: [LICENSE](./LICENSE).`;
};

const licenseReadmeBlock = (licenseType, config) =>
  `${licenseReadmeSentence(licenseType)}\n\nCopyright © ${new Date().getFullYear()} ${config.author}`;

const applyTypescriptConfig = async (workspace, answers) => {
  if (!answers.typescript || !isOwnedFoundation(answers.foundation)) {
    return;
  }
  const template = answers.vite ? 'shared/typescript/tsconfig.vite.json' : 'shared/typescript/tsconfig.node.json';
  await workspace.copyTemplate(template, 'tsconfig.json', { overwrite: false });
};

const applyOwnedFoundationTemplates = async (workspace, answers) => {
  if (!answers.nodeProject || !isOwnedFoundation(answers.foundation)) {
    return;
  }
  if (answers.vite) {
    const entryExt = answers.typescript ? (answers.react ? 'tsx' : 'ts') : answers.react ? 'jsx' : 'js';
    const rootId = answers.react ? 'root' : 'app';
    await workspace.write(
      'index.html',
      await renderAsset('templates/owned/vite/index.html.tmpl', {
        PROJECT_TITLE: viteProjectTitle(answers),
        ROOT_ID: rootId,
        ENTRY_FILE: `main.${entryExt}`,
        STYLE_LINK: '    <link href="/src/style.css" rel="stylesheet" />\n',
      }),
      { overwrite: workspace.force },
    );

    if (answers.react) {
      await workspace.copyTemplateDir(
        `owned/react-${answers.typescript ? 'ts' : 'js'}${answers.tailwind ? '-tailwind' : ''}/src`,
        'src',
      );
    } else if (answers.vue) {
      await workspace.copyTemplateDir(
        `owned/vue-${answers.typescript ? 'ts' : 'js'}${answers.tailwind ? '-tailwind' : ''}/src`,
        'src',
      );
    } else {
      await workspace.copyTemplate(
        `owned/vite/vanilla-main${answers.tailwind ? '-tailwind' : ''}.${answers.typescript ? 'ts' : 'js'}`,
        `src/main.${answers.typescript ? 'ts' : 'js'}`,
      );
    }

    const viteTemplate = answers.react
      ? 'owned/vite/vite.config.react.js.tmpl'
      : answers.vue
        ? 'owned/vite/vite.config.vue.js.tmpl'
        : 'owned/vite/vite.config.js.tmpl';
    const viteValues = {
      DEV_PORT: answers.devPort,
      TAILWIND_IMPORT: answers.tailwind ? "import tailwindcss from '@tailwindcss/vite';\n" : '',
    };
    if (answers.react || answers.vue) {
      viteValues.TAILWIND_PLUGIN = answers.tailwind ? ', tailwindcss()' : '';
    } else {
      viteValues.TAILWIND_PLUGIN_BLOCK = answers.tailwind ? '  plugins: [tailwindcss()],\n' : '';
    }
    const viteConfig = await renderAsset(`templates/${viteTemplate}`, viteValues);
    await workspace.write(`vite.config.${answers.typescript ? 'ts' : 'js'}`, viteConfig, {
      overwrite: workspace.force,
    });

    await workspace.copyTemplate(
      answers.tailwind ? 'owned/vite/tailwind.css' : 'owned/vite/reset.css',
      'src/style.css',
    );

    if (answers.vitest) {
      const setupExt = answers.typescript ? 'ts' : 'js';
      const setupFiles = answers.react
        ? `    setupFiles: ['src/setupTests.${setupExt}'],\n`
        : '';
      const pluginConfig = vitestPluginConfig(answers);
      await workspace.write(
        'vitest.config.mts',
        await renderAsset('templates/owned/vite/vitest.config.mts.tmpl', {
          VITEST_ENVIRONMENT: 'jsdom',
          TEST_EXTENSIONS: answers.typescript
            ? answers.react
              ? '{ts,tsx}'
              : 'ts'
            : answers.react
              ? '{js,jsx}'
              : 'js',
          SETUP_FILES: setupFiles,
          VITEST_PLUGIN_IMPORT: pluginConfig.import,
          VITEST_PLUGIN_BLOCK: pluginConfig.block,
        }),
      );
      if (answers.react) {
        await workspace.copyTemplate(`owned/vite/setupTests.${setupExt}`, `src/setupTests.${setupExt}`);
        await workspace.copyTemplate(
          `owned/tests/react/App.test.${answers.typescript ? 'tsx' : 'jsx'}`,
          `src/App.test.${answers.typescript ? 'tsx' : 'jsx'}`,
        );
      } else if (answers.vue) {
        await workspace.copyTemplate(
          `owned/tests/vue/App.test.${answers.typescript ? 'ts' : 'js'}`,
          `src/App.test.${answers.typescript ? 'ts' : 'js'}`,
        );
      } else {
        await workspace.copyTemplate(
          `owned/tests/vanilla/main.test.${answers.typescript ? 'ts' : 'js'}`,
          `src/main.test.${answers.typescript ? 'ts' : 'js'}`,
        );
      }
    }
    return;
  }

  if (answers.vitest) {
    const setupExt = answers.typescript ? 'ts' : 'js';
    const setupFiles = answers.react
      ? `    setupFiles: ['src/setupTests.${setupExt}'],\n`
      : '';
    const pluginConfig = vitestPluginConfig(answers);
    await workspace.write(
      'vitest.config.mts',
      await renderAsset('templates/owned/vite/vitest.config.mts.tmpl', {
        VITEST_ENVIRONMENT: answers.react || answers.vue ? 'jsdom' : 'node',
        TEST_EXTENSIONS: answers.typescript
          ? answers.react
            ? '{ts,tsx}'
            : 'ts'
          : answers.react
            ? '{js,jsx}'
            : 'js',
        SETUP_FILES: setupFiles,
        VITEST_PLUGIN_IMPORT: pluginConfig.import,
        VITEST_PLUGIN_BLOCK: pluginConfig.block,
      }),
    );
  }

  if (answers.react) {
    await workspace.copyTemplateDir(`owned/react-${answers.typescript ? 'ts' : 'js'}/src`, 'src');
    if (answers.vitest) {
      const setupExt = answers.typescript ? 'ts' : 'js';
      await workspace.copyTemplate(`owned/vite/setupTests.${setupExt}`, `src/setupTests.${setupExt}`);
      await workspace.copyTemplate(
        `owned/tests/react/App.test.${answers.typescript ? 'tsx' : 'jsx'}`,
        `src/App.test.${answers.typescript ? 'tsx' : 'jsx'}`,
      );
    }
    return;
  }
  if (answers.vue) {
    await workspace.copyTemplateDir(`owned/vue-${answers.typescript ? 'ts' : 'js'}/src`, 'src');
    if (answers.vitest) {
      await workspace.copyTemplate(
        `owned/tests/vue/App.test.${answers.typescript ? 'ts' : 'js'}`,
        `src/App.test.${answers.typescript ? 'ts' : 'js'}`,
      );
    }
    return;
  }
  await workspace.copyTemplateDir(`owned/node-${answers.typescript ? 'ts' : 'js'}/src`, 'src');
  if (answers.vitest) {
    await workspace.copyTemplate(
      `owned/tests/node/index.test.${answers.typescript ? 'ts' : 'js'}`,
      `src/index.test.${answers.typescript ? 'ts' : 'js'}`,
    );
  }
};

const applyLicense = async ({ workspace, answers, config }) => {
  if (!answers.license) {
    return;
  }
  const license = config.licenseTypes[answers.licenseType];
  if (!license) {
    throw new Error(`Unknown license type: ${answers.licenseType}`);
  }
  if (license.template) {
    await workspace.write('LICENSE', await renderLicense(license.template, config));
  }

  const readmePath = workspace.targetPath('README.md');
  const block = licenseReadmeBlock(answers.licenseType, config);
  if (await fileExists(readmePath)) {
    const current = await readText(readmePath);
    const hasHeading = current.split(/\r?\n/).some((readmeLine) => readmeLine.trim() === '## License');
    if (current.includes(block)) {
      workspace.skipped.push('README.md already has license');
      workspace.mark('README.md');
    } else {
      const content = `${current.trimEnd()}\n\n${hasHeading ? '' : '## License\n\n'}${block}\n`;
      await workspace.write('README.md', content);
    }
  } else {
    await workspace.write('README.md', `# ${sanitizePackageName(workspace.targetDir)}\n\n## License\n\n${block}\n`);
  }
};

const applyReadme = async ({ workspace }) => {
  await workspace.write('README.md', `# ${sanitizePackageName(workspace.targetDir)}\n`, {
    overwrite: false,
  });
};

const applyAgents = async ({ workspace, answers, config }) => {
  if (!answers.agents) {
    return;
  }
  const tech = [];
  if (answers.nix) tech.push('- Nix flake dev shell');
  if (answers.direnv) tech.push('- direnv loads the flake shell');
  if (answers.nodeProject) tech.push(`- Node ${answers.nodeMajor} with ${answers.toolchainManager}`);
  if (answers.nodeProject) tech.push(`- ${foundationLabel(answers.foundation, config)} foundation`);
  if (answers.vite) tech.push(`- Vite${answers.react ? ' + React' : answers.vue ? ' + Vue' : ''}`);
  if (answers.typescript) tech.push('- TypeScript');
  if (answers.vitest) tech.push('- Vitest');
  if (answers.prettier) tech.push('- Prettier');
  if (answers.tailwind) tech.push('- Tailwind');

  const rules = [];
  if (answers.prettier) {
    rules.push(
      '- **Formatting:** When creating brand new files or making large edits, run `pnpm format:all` when you are done with all edits. For single-file-only edits, run `pnpm format <file>` when done with all edits.',
    );
  }
  if (answers.devServer || isSeededFoundation(answers.foundation)) {
    rules.push(
      '- **Dev servers:** Do not kill existing dev servers unless explicitly asked to. If you start a dev server while responding to a request, ensure that it is stopped when you are done.',
    );
  }
  if (isNextFoundation(answers.foundation)) {
    rules.push(
      '- **This is NOT the Next.js you know.** This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.',
    );
  }
  await workspace.write(
    'AGENTS.md',
    await renderAsset('templates/shared/agents/AGENTS.md.tmpl', {
      TECH: tech.length ? tech.join('\n') : '- No runtime stack selected',
      RULES: rules.join('\n'),
    }),
    { overwrite: false },
  );
};

const applyPnpmWorkspace = async ({ workspace, answers }) => {
  if (answers.nodeProject && answers.toolchainManager === 'pnpm') {
    await workspace.write('pnpm-workspace.yaml', 'packages:\n  - .\n', { overwrite: false });
  }
};

module.exports = {
  applyAgents,
  applyCommon,
  applyLicense,
  applyOwnedFoundationTemplates,
  applyNix,
  applyPackageJson,
  applyPnpmWorkspace,
  applyReadme,
  applyTsMode,
  applyTypescriptConfig,
  sanitizePackageName,
};
