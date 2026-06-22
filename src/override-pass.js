'use strict';

const { applyActionManifest } = require('./helpers/actions');

const seededFoundationOverridePaths = ({ answers, seedRun }) =>
  seedRun ? [`overrides/foundations/${answers.foundation}.json`] : [];

const applySeededFoundationOverrides = async ({ workspace, answers, seedRun, values = {} }) => {
  for (const manifestPath of seededFoundationOverridePaths({ answers, seedRun })) {
    await applyActionManifest({
      workspace,
      manifestPath,
      optional: true,
      context: { answers, values },
    });
  }
};

module.exports = {
  applySeededFoundationOverrides,
};
