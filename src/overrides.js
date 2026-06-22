'use strict';

const { applyActionManifest } = require('./helpers/actions');

const overridePaths = ({ answers, frameworkRun, frontendBaseRun }) => {
  const paths = [];
  if (frameworkRun) {
    paths.push(`overrides/frameworks/${answers.framework}.json`);
  }
  if (frontendBaseRun) {
    paths.push(`overrides/frontend-bases/${answers.frontendBase}.json`);
  }
  return paths;
};

const applyTemplateOverrides = async ({ workspace, answers, frameworkRun, frontendBaseRun, values = {} }) => {
  for (const manifestPath of overridePaths({ answers, frameworkRun, frontendBaseRun })) {
    await applyActionManifest({
      workspace,
      manifestPath,
      optional: true,
      context: { answers, values },
    });
  }
};

module.exports = {
  applyTemplateOverrides,
};
