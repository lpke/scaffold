'use strict';

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

const unitTestPattern = (answers) => {
  const root = sourceRoot(answers);
  const kind = answers.foundation === 'vue-vite' ? '{test,spec}' : 'test';
  return `${root}/**/*.${kind}.${testExtensions(answers)}`;
};

const browserTestPattern = (answers) =>
  `${sourceRoot(answers)}/**/*.browser.test.${testExtensions(answers)}`;

const unitEnvironment = (answers) => {
  if (isNextFoundation(answers.foundation)) {
    return 'node';
  }
  if (!answers.vite && !answers.react && !answers.vue) {
    return 'node';
  }
  return 'jsdom';
};

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

const unitSetupLine = (answers) => {
  if (!answers.react || isNextFoundation(answers.foundation)) {
    return null;
  }
  const extension = answers.typescript ? 'ts' : 'js';
  return `          setupFiles: ['src/setupTests.${extension}'],`;
};

const projectLines = (answers) => {
  const setupLine = unitSetupLine(answers);
  return [
    '  test: {',
    '    projects: [',
    '      {',
    '        extends: true,',
    '        test: {',
    "          name: 'unit',",
    `          environment: '${unitEnvironment(answers)}',`,
    '          globals: true,',
    `          include: ['${unitTestPattern(answers)}'],`,
    "          exclude: [...commonExclude, '**/*.browser.test.*'],",
    ...(setupLine ? [setupLine] : []),
    '        },',
    '      },',
    '      {',
    '        extends: true,',
    '        test: {',
    "          name: 'browser',",
    '          globals: true,',
    `          include: ['${browserTestPattern(answers)}'],`,
    '          exclude: commonExclude,',
    '          browser: {',
    '            enabled: true,',
    '            headless: true,',
    '            provider: playwright(),',
    "            instances: [{ browser: 'chromium' }],",
    '          },',
    '        },',
    '      },',
    '    ],',
    '  },',
  ];
};

const standardConfig = (answers) => {
  const react = reactPluginConfig(answers);
  const nuxt = nuxtConfig(answers);
  const vue = ownedVueConfig(answers);
  const imports = [...nuxt.imports, ...react.imports, ...vue.imports];
  const prelude = nuxt.prelude;
  const config = [...react.config, ...nuxt.config, ...vue.config];
  if (
    answers.typescript &&
    (answers.foundation === 'next' || answers.foundation === 'react-vite')
  ) {
    config.push('  resolve: { tsconfigPaths: true },');
  }

  return [
    ...imports,
    "import { playwright } from '@vitest/browser-playwright';",
    "import { configDefaults, defineConfig } from 'vitest/config';",
    '',
    "const commonExclude = [...configDefaults.exclude, '**/.direnv/**'];",
    ...(prelude.length ? ['', ...prelude] : []),
    '',
    'export default defineConfig({',
    ...config,
    ...projectLines(answers),
    '});',
    '',
  ].join('\n');
};

const vueViteConfig = (answers) =>
  [
    "import { playwright } from '@vitest/browser-playwright';",
    "import { configDefaults, defineConfig, mergeConfig } from 'vitest/config';",
    "import viteConfig from './vite.config';",
    '',
    "const commonExclude = [...configDefaults.exclude, '**/.direnv/**', 'e2e/**'];",
    '',
    'export default mergeConfig(',
    '  viteConfig,',
    '  defineConfig({',
    ...projectLines(answers).map((line) => `  ${line}`),
    '  }),',
    ');',
    '',
  ].join('\n');

const configPath = (answers) =>
  answers.foundation === 'vue-vite'
    ? `vitest.config.${answers.typescript ? 'ts' : 'js'}`
    : 'vitest.config.mts';

const applyVitestBrowser = async (workspace, answers) => {
  if (!answers.vitestBrowser) {
    return;
  }
  const config =
    answers.foundation === 'vue-vite'
      ? vueViteConfig(answers)
      : standardConfig(answers);
  await workspace.write(configPath(answers), config);
  await workspace.copyTemplate(
    `shared/vitest/browser.browser.test.${answers.typescript ? 'ts' : 'js'}`,
    `${sourceRoot(answers)}/browser.browser.test.${answers.typescript ? 'ts' : 'js'}`,
    { overwrite: false },
  );
};

module.exports = {
  applyVitestBrowser,
};
