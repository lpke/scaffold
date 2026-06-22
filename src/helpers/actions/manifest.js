'use strict';

const { assetPath, readAssetJson } = require('../../assets');
const { fileExists } = require('../../detect');
const { applyActions } = require('./executor');

const applyActionManifest = async ({ workspace, manifestPath, context = {}, optional = false }) => {
  if (optional && !(await fileExists(assetPath(manifestPath)))) {
    return;
  }
  const manifest = await readAssetJson(manifestPath);
  if (manifest.version !== 1) {
    throw new Error(`Unsupported action manifest version in ${manifestPath}: ${manifest.version}`);
  }
  await applyActions({
    workspace,
    actions: manifest.actions ?? [],
    context: {
      ...context,
      manifestPath,
    },
  });
};

module.exports = {
  applyActionManifest,
};
