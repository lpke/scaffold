'use strict';

const { applyActionManifest } = require('./helpers/actions');

const seededFoundationOverridePaths = ({ answers, seedRun }) =>
  seedRun ? [`overrides/foundations/${answers.foundation}.json`] : [];

const nuxtUsesFlatStructure = (answers) => {
  if (answers.foundation !== 'nuxt') {
    return false;
  }
  const match = String(answers.seedVersion || '').match(/^(\d+)\./);
  return match ? Number(match[1]) <= 3 : false;
};

const seededFoundationOverrideValues = (answers) => ({
  NUXT_FLAT: nuxtUsesFlatStructure(answers),
  SCRIPT_LANG: answers.typescript ? 'ts' : 'js',
});

const applySeededFoundationOverrides = async ({ workspace, answers, seedRun, values = {} }) => {
  for (const manifestPath of seededFoundationOverridePaths({ answers, seedRun })) {
    await applyActionManifest({
      workspace,
      manifestPath,
      optional: true,
      context: { answers, values: { ...seededFoundationOverrideValues(answers), ...values } },
    });
  }
};

module.exports = {
  applySeededFoundationOverrides,
};
