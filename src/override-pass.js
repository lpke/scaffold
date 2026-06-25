'use strict';

const path = require('node:path');

const { applyActionManifest } = require('./helpers/actions');
const { projectTechLines } = require('./project-tech');

const seededFoundationOverridePaths = ({ answers, seedRun }) =>
  seedRun ? [`overrides/foundations/${answers.foundation}.json`] : [];

const nuxtUsesFlatStructure = (answers) => {
  if (answers.foundation !== 'nuxt') {
    return false;
  }
  const match = String(answers.seedVersion || '').match(/^(\d+)\./);
  return match ? Number(match[1]) <= 3 : false;
};

const seededFoundationOverrideValues = (answers, config, workspace) => ({
  NUXT_FLAT: nuxtUsesFlatStructure(answers),
  PROJECT_NAME: path.basename(path.resolve(workspace.targetDir)),
  README_TECH: projectTechLines(answers, config),
  SCRIPT_LANG: answers.typescript ? 'ts' : 'js',
});

const applySeededFoundationOverrides = async ({ workspace, answers, config, seedRun, values = {} }) => {
  for (const manifestPath of seededFoundationOverridePaths({ answers, seedRun })) {
    await applyActionManifest({
      workspace,
      manifestPath,
      optional: true,
      context: { answers, values: { ...seededFoundationOverrideValues(answers, config, workspace), ...values } },
    });
  }
};

module.exports = {
  applySeededFoundationOverrides,
};
