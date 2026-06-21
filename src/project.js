'use strict';

const path = require('node:path');

const { commandVersion } = require('./commands');
const { readAsset, renderAsset } = require('./assets');
const { fileExists, readJsonFile } = require('./detect');
const { parseJson } = require('./json');

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
    if (answers.tailwindPrettier) {
      addDev('prettier-plugin-tailwindcss');
    }
  }

  if (answers.framework !== 'none') {
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
      addDev('@types/react');
      addDev('@types/react-dom');
    }
    if (answers.vue) {
      addDep('vue');
    }
  }

  if (answers.vitest) {
    addDev('vitest');
    if (answers.react || answers.vue) {
      addDev('jsdom');
      if (answers.react) {
        addDev('@testing-library/jest-dom');
        addDev('@testing-library/react');
        addDev('@testing-library/user-event');
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

  if (answers.framework !== 'none') {
    if (answers.typescript) {
      scripts.typecheck = 'tsc --noEmit';
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

  if (creating && answers.framework === 'none') {
    pkg.type ??= 'module';
  }

  if (answers.license && answers.licenseType !== 'UNLICENSED') {
    pkg.license = answers.licenseType;
  } else if (answers.licenseType === 'UNLICENSED') {
    pkg.license = 'UNLICENSED';
  }

  pkg.scripts ??= {};
  mergeObjectDefaults(pkg.scripts, scriptSet(answers));

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
  const flake = await renderAsset('templates/nix/flake.nix.tmpl', {
    PROJECT_NAME: sanitizePackageName(workspace.targetDir),
    NIXPKGS: nodeConfig.nixpkgs,
    NIXPKGS_CONFIG: renderNixpkgsConfig(nodeConfig),
    PACKAGES: renderPackageList(answers, config),
  });
  await workspace.write('flake.nix', flake);
  if (answers.direnv) {
    await workspace.copyTemplate('common/dot_envrc', '.envrc', { overwrite: true });
  }
};

const applyCommon = async ({ workspace, answers }) => {
  await workspace.copyTemplate('common/dot_editorconfig', '.editorconfig', { overwrite: false });
  await workspace.mergeLines('.gitignore', [
    'node_modules',
    '.nuxt',
    '.output',
    '.next',
    'dist',
    'coverage',
    '.vite',
    '*.log',
    '.env',
    '.env.*',
    '!.env.example',
    '.flake.local/',
    '.direnv',
    '.DS_Store',
    '*.scaffold-backup',
  ]);

  if (answers.prettier) {
    await workspace.mergeLines('.prettierignore', [
      'node_modules',
      '.nuxt',
      '.output',
      '.next',
      'dist',
      'coverage',
      '.vite',
      '*.log',
      '.env',
      '.env.*',
      '!.env.example',
      '.flake.local/',
      '.direnv',
      '.DS_Store',
      'pnpm-lock.yaml',
      'yarn.lock',
      'package-lock.json',
    ]);

    if (answers.tailwindPrettier) {
      await workspace.write(
        'prettier.config.mjs',
        "export default {\n  singleQuote: true,\n  plugins: ['prettier-plugin-tailwindcss'],\n};\n",
      );
    } else {
      await workspace.copyTemplate('common/dot_prettierrc', '.prettierrc', { overwrite: true });
    }
  }
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
  await workspace.write('tsconfig.json', `${JSON.stringify(tsconfig, null, 2)}\n`);
};

const readAssetFromTarget = async (filePath) => {
  const fs = require('node:fs/promises');
  return fs.readFile(filePath, 'utf8');
};

const applyTypescriptConfig = async (workspace, answers) => {
  if (!answers.typescript || answers.framework !== 'none') {
    return;
  }
  const template = answers.vite ? 'typescript/tsconfig.vite.json' : 'typescript/tsconfig.node.json';
  await workspace.copyTemplate(template, 'tsconfig.json', { overwrite: false });
};

const applyLocalStarter = async (workspace, answers) => {
  if (!answers.nodeProject || answers.framework !== 'none') {
    return;
  }
  if (answers.vite) {
    const entryExt = answers.typescript ? (answers.react ? 'tsx' : 'ts') : answers.react ? 'jsx' : 'js';
    const rootId = answers.react ? 'root' : 'app';
    await workspace.write(
      'index.html',
      await renderAsset('templates/starters/vite/index.html.tmpl', {
        PROJECT_TITLE: sanitizePackageName(workspace.targetDir),
        ROOT_ID: rootId,
        ENTRY_FILE: `main.${entryExt}`,
      }),
      { overwrite: workspace.force },
    );

    if (answers.react) {
      await workspace.copyTemplateDir(`starters/react-${answers.typescript ? 'ts' : 'js'}/src`, 'src');
    } else if (answers.vue) {
      await workspace.copyTemplateDir(`starters/vue-${answers.typescript ? 'ts' : 'js'}/src`, 'src');
    } else {
      await workspace.copyTemplate(
        `starters/vite/vanilla-main.${answers.typescript ? 'ts' : 'js'}`,
        `src/main.${answers.typescript ? 'ts' : 'js'}`,
      );
    }

    const viteTemplate = answers.react
      ? 'starters/vite/vite.config.react.js.tmpl'
      : answers.vue
        ? 'starters/vite/vite.config.vue.js.tmpl'
        : 'starters/vite/vite.config.js.tmpl';
    const viteConfig = await renderAsset(`templates/${viteTemplate}`, {
      DEV_PORT: answers.devPort,
    });
    await workspace.write(`vite.config.${answers.typescript ? 'ts' : 'js'}`, viteConfig, {
      overwrite: workspace.force,
    });

    if (answers.vitest) {
      const setupFiles = answers.react
        ? "    setupFiles: ['src/setupTests.ts'],"
        : '';
      await workspace.write(
        'vitest.config.mts',
        await renderAsset('templates/starters/vite/vitest.config.mts.tmpl', {
          VITEST_ENVIRONMENT: answers.react || answers.vue ? 'jsdom' : 'node',
          TEST_EXTENSIONS: answers.typescript
            ? answers.react
              ? '{ts,tsx}'
              : 'ts'
            : answers.react
              ? '{js,jsx}'
              : 'js',
          SETUP_FILES: setupFiles,
        }),
      );
      if (answers.react) {
        await workspace.copyTemplate('starters/vite/setupTests.ts', 'src/setupTests.ts');
      }
    }
    return;
  }

  if (answers.react) {
    await workspace.copyTemplateDir(`starters/react-${answers.typescript ? 'ts' : 'js'}/src`, 'src');
    return;
  }
  if (answers.vue) {
    await workspace.copyTemplateDir(`starters/vue-${answers.typescript ? 'ts' : 'js'}/src`, 'src');
    return;
  }
  await workspace.copyTemplateDir(`starters/node-${answers.typescript ? 'ts' : 'js'}/src`, 'src');
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
    await workspace.write(
      'LICENSE',
      await renderAsset(`templates/${license.template}`, {
        YEAR: new Date().getFullYear(),
        AUTHOR: config.author,
      }),
    );
  }

  const readmePath = workspace.targetPath('README.md');
  const line = `Licensed under ${answers.licenseType}.`;
  if (await fileExists(readmePath)) {
    await workspace.mergeLines('README.md', ['## License', '', line]);
  } else {
    await workspace.write('README.md', `# ${sanitizePackageName(workspace.targetDir)}\n\n## License\n\n${line}\n`);
  }
};

const applyAgents = async ({ workspace, answers }) => {
  if (!answers.agents) {
    return;
  }
  const tech = [];
  if (answers.nix) tech.push('- Nix flake dev shell.');
  if (answers.direnv) tech.push('- direnv loads the flake shell.');
  if (answers.nodeProject) tech.push(`- Node ${answers.nodeMajor} with ${answers.toolchainManager}.`);
  if (answers.framework !== 'none') tech.push(`- ${answers.framework === 'next' ? 'Next.js' : 'Nuxt'} project.`);
  if (answers.vite) tech.push(`- Vite${answers.react ? ' + React' : answers.vue ? ' + Vue' : ''}.`);
  if (answers.typescript) tech.push('- TypeScript.');
  if (answers.vitest) tech.push('- Vitest.');
  if (answers.prettier) tech.push('- Prettier.');

  const rules = [];
  if (answers.prettier) {
    rules.push('- Format changed files with the package format script before committing.');
  }
  if (answers.vite && answers.devServer) {
    rules.push(`- Dev server defaults to port ${answers.devPort}; do not kill existing dev servers without checking first.`);
  }
  if (rules.length === 0) {
    rules.push('- Keep changes scoped and document non-obvious project decisions.');
  }

  await workspace.write(
    'AGENTS.md',
    await renderAsset('templates/agents/AGENTS.md.tmpl', {
      TECH: tech.length ? tech.join('\n') : '- No runtime stack selected.',
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
  applyLocalStarter,
  applyNix,
  applyPackageJson,
  applyPnpmWorkspace,
  applyTsMode,
  applyTypescriptConfig,
  sanitizePackageName,
};
