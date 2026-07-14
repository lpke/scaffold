'use strict';

const fsp = require('node:fs/promises');
const path = require('node:path');

const { fileExists, readText } = require('./detect');
const {
  isNextFoundation,
  isNuxtFoundation,
  isOwnedFoundation,
} = require('./foundations');

const nuxtUsesFlatStructure = (answers) => {
  const match = String(answers.seedVersion || '').match(/^(\d+)(?:\.|$)/);
  return match ? Number(match[1]) <= 3 : false;
};

const sourceRoot = (answers) => {
  if (isNuxtFoundation(answers.foundation)) {
    return nuxtUsesFlatStructure(answers) ? 'pages' : 'app/pages';
  }
  return 'src';
};

const testExtensions = (answers) => {
  if (answers.react) {
    return answers.typescript ? '{ts,tsx}' : '{js,jsx}';
  }
  return answers.typescript ? 'ts' : 'js';
};

const testPattern = (answers, suffix = '') => {
  const kind =
    answers.foundation === 'vue-vite' && !suffix ? '{test,spec}' : 'test';
  return `${sourceRoot(answers)}/**/*.${suffix}${kind}.${testExtensions(answers)}`;
};

const project = (lines) => [
  '      {',
  '        extends: true,',
  '        test: {',
  ...lines.map((line) => `          ${line}`),
  '        },',
  '      },',
];

const nodeProject = (answers) =>
  project([
    "name: 'node',",
    "environment: 'node',",
    'globals: true,',
    `include: ['${testPattern(answers)}'],`,
    "exclude: [...commonExclude, '**/*.dom.test.*', '**/*.browser.test.*'],",
  ]);

const domProject = (answers) => {
  const lines = [
    "name: 'dom',",
    "environment: 'jsdom',",
    'globals: true,',
    `include: ['${testPattern(answers, 'dom.')}'],`,
    'exclude: commonExclude,',
  ];
  if (answers.react && !isNextFoundation(answers.foundation)) {
    lines.push(
      `setupFiles: ['src/setupTests.${answers.typescript ? 'ts' : 'js'}'],`,
    );
  }
  return project(lines);
};

const browserProject = (answers) =>
  project([
    "name: 'browser',",
    'globals: true,',
    `include: ['${testPattern(answers, 'browser.')}'],`,
    'exclude: commonExclude,',
    'browser: {',
    '  enabled: true,',
    '  headless: true,',
    '  provider: playwright(),',
    "  instances: [{ browser: 'chromium' }],",
    '},',
  ]);

const testConfig = (answers) => [
  '  test: {',
  '    projects: [',
  ...nodeProject(answers),
  ...(answers.vitestJsdom ? domProject(answers) : []),
  ...(answers.vitestBrowser ? browserProject(answers) : []),
  '    ],',
  '  },',
];

const reactPluginConfig = (answers) => {
  if (!answers.react) {
    return { imports: [], config: [] };
  }
  if (answers.vite || !isOwnedFoundation(answers.foundation)) {
    return {
      imports: [
        "import babel from '@rolldown/plugin-babel';",
        "import react, { reactCompilerPreset } from '@vitejs/plugin-react';",
      ],
      config: [
        '  plugins: [react(), babel({ presets: [reactCompilerPreset()] })],',
      ],
    };
  }
  return {
    imports: ["import react from '@vitejs/plugin-react';"],
    config: ['  plugins: [react()],'],
  };
};

const nuxtConfig = (answers) => {
  if (!isNuxtFoundation(answers.foundation)) {
    return { imports: [], prelude: [], config: [] };
  }
  const aliasRoot = nuxtUsesFlatStructure(answers) ? '' : 'app/';
  return {
    imports: [
      "import { fileURLToPath } from 'node:url';",
      "import vue from '@vitejs/plugin-vue';",
    ],
    prelude: [
      'const alias = {',
      ...['components', 'composables', 'data', 'pages', 'types', 'utils'].map(
        (name) =>
          `  ${name}: fileURLToPath(new URL('./${aliasRoot}${name}', import.meta.url)),`,
      ),
      '};',
    ],
    config: ['  plugins: [vue()],', '  resolve: { alias },'],
  };
};

const ownedVueConfig = (answers) =>
  isOwnedFoundation(answers.foundation) && answers.vue
    ? {
        imports: ["import vue from '@vitejs/plugin-vue';"],
        config: ['  plugins: [vue()],'],
      }
    : { imports: [], config: [] };

const standardConfig = (answers) => {
  const react = reactPluginConfig(answers);
  const nuxt = nuxtConfig(answers);
  const vue = ownedVueConfig(answers);
  const imports = [...nuxt.imports, ...react.imports, ...vue.imports];
  const config = [...react.config, ...nuxt.config, ...vue.config];
  if (
    answers.typescript &&
    (answers.foundation === 'next' || answers.foundation === 'react-vite')
  ) {
    config.push('  resolve: { tsconfigPaths: true },');
  }

  return [
    ...imports,
    ...(answers.vitestBrowser
      ? ["import { playwright } from '@vitest/browser-playwright';"]
      : []),
    "import { configDefaults, defineConfig } from 'vitest/config';",
    '',
    "const commonExclude = [...configDefaults.exclude, '**/.direnv/**'];",
    ...(nuxt.prelude.length ? ['', ...nuxt.prelude] : []),
    '',
    'export default defineConfig({',
    ...config,
    ...testConfig(answers),
    '});',
    '',
  ].join('\n');
};

const vueViteConfig = (answers) =>
  [
    ...(answers.vitestBrowser
      ? ["import { playwright } from '@vitest/browser-playwright';"]
      : []),
    "import { configDefaults, defineConfig, mergeConfig } from 'vitest/config';",
    "import viteConfig from './vite.config';",
    '',
    "const commonExclude = [...configDefaults.exclude, '**/.direnv/**', 'e2e/**'];",
    '',
    'export default mergeConfig(',
    '  viteConfig,',
    '  defineConfig({',
    ...testConfig(answers).map((line) => `  ${line}`),
    '  }),',
    ');',
    '',
  ].join('\n');

const configPath = (answers) =>
  answers.foundation === 'vue-vite'
    ? `vitest.config.${answers.typescript ? 'ts' : 'js'}`
    : 'vitest.config.mts';

const fileExistsInWorkspace = (workspace, relativePath) =>
  fileExists(workspace.targetPath(relativePath));

const copySampleUnlessPresent = async ({
  workspace,
  candidates,
  template,
  output,
}) => {
  for (const candidate of candidates) {
    if (await fileExistsInWorkspace(workspace, candidate)) {
      return;
    }
  }
  await workspace.copyTemplate(template, output, { overwrite: false });
};

const findVueViteSeedTests = async (workspace, relativeDir = 'src') => {
  let entries;
  try {
    entries = await fsp.readdir(workspace.targetPath(relativeDir), { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }

  const tests = [];
  for (const entry of entries) {
    const relativePath = path.posix.join(relativeDir, entry.name);
    if (entry.isDirectory()) {
      tests.push(...(await findVueViteSeedTests(workspace, relativePath)));
    } else if (
      entry.isFile() &&
      /\.(?:spec|test)\.(?:js|ts)$/.test(entry.name) &&
      !/\.(?:dom|browser)\.test\.(?:js|ts)$/.test(entry.name)
    ) {
      tests.push(relativePath);
    }
  }
  return tests;
};

const renameVueViteDomTests = async ({ workspace, answers, seedRun }) => {
  if (!answers.vitestJsdom || seedRun?.foundation !== 'vue-vite') {
    return [];
  }

  const renamed = [];
  for (const from of await findVueViteSeedTests(workspace)) {
    const to = from.replace(/\.(?:spec|test)\.(js|ts)$/, '.dom.test.$1');
    await workspace.write(to, await readText(workspace.targetPath(from)), {
      overwrite: false,
    });
    await workspace.remove(from, { backup: false });
    renamed.push(to);
  }
  return renamed;
};

const addSampleTests = async ({ workspace, answers, seedRun }) => {
  const extension = answers.typescript ? 'ts' : 'js';
  const root = sourceRoot(answers);
  const seededDomTests = await renameVueViteDomTests({ workspace, answers, seedRun });

  await copySampleUnlessPresent({
    workspace,
    candidates: [
      `${root}/vitest.test.${extension}`,
      `src/index.test.${extension}`,
      `src/app/page.test.${answers.typescript ? 'tsx' : 'jsx'}`,
    ],
    template: `shared/vitest/node.test.${extension}`,
    output: `${root}/vitest.test.${extension}`,
  });

  if (answers.vitestJsdom) {
    await copySampleUnlessPresent({
      workspace,
      candidates: [
        ...seededDomTests,
        `${root}/vitest.dom.test.${extension}`,
        `src/App.dom.test.${answers.react ? (answers.typescript ? 'tsx' : 'jsx') : extension}`,
        `src/main.dom.test.${extension}`,
        `${root}/index.dom.test.${extension}`,
        `src/components/__tests__/HelloWorld.dom.test.${extension}`,
      ],
      template: `shared/vitest/dom.dom.test.${extension}`,
      output: `${root}/vitest.dom.test.${extension}`,
    });
  }

  if (answers.vitestBrowser) {
    await workspace.copyTemplate(
      `shared/vitest/browser.browser.test.${extension}`,
      `${root}/vitest.browser.test.${extension}`,
      { overwrite: false },
    );
  }
};

const applyVitest = async ({ workspace, answers, seedRun = null }) => {
  if (!answers.vitest) {
    return;
  }
  const config =
    answers.foundation === 'vue-vite'
      ? vueViteConfig(answers)
      : standardConfig(answers);
  await workspace.write(configPath(answers), config);
  await addSampleTests({ workspace, answers, seedRun });
};

module.exports = {
  applyVitest,
};
