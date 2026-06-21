'use strict';

const { readAssetJson } = require('./assets');

const requireObject = (value, label) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Expected ${label} to be an object in config.json`);
  }
};

const requireString = (value, label) => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Expected ${label} to be a non-empty string in config.json`);
  }
};

const loadConfig = async () => {
  const config = await readAssetJson('config.json');
  requireObject(config.nodeTargets, 'nodeTargets');
  requireObject(config.packageManagers, 'packageManagers');
  requireObject(config.versions, 'versions');
  requireObject(config.frameworks, 'frameworks');
  requireObject(config.licenseTypes, 'licenseTypes');
  requireString(config.defaultLicense, 'defaultLicense');

  for (const [major, target] of Object.entries(config.nodeTargets)) {
    requireObject(target, `nodeTargets.${major}`);
    requireString(target.nixpkgs, `nodeTargets.${major}.nixpkgs`);
    requireString(target.nodePackage, `nodeTargets.${major}.nodePackage`);
    requireString(target.engine, `nodeTargets.${major}.engine`);
    if (
      target.permittedInsecurePackages !== undefined &&
      (!Array.isArray(target.permittedInsecurePackages) ||
        target.permittedInsecurePackages.some((pkg) => typeof pkg !== 'string' || !pkg.trim()))
    ) {
      throw new Error(
        `Expected nodeTargets.${major}.permittedInsecurePackages to be an array of non-empty strings`,
      );
    }
  }

  for (const [name, manager] of Object.entries(config.packageManagers)) {
    requireObject(manager, `packageManagers.${name}`);
    requireString(manager.defaultVersion, `packageManagers.${name}.defaultVersion`);
    requireString(manager.engine, `packageManagers.${name}.engine`);
    requireString(manager.lockfile, `packageManagers.${name}.lockfile`);
    if (!Array.isArray(manager.installCommand) || manager.installCommand.length === 0) {
      throw new Error(`Expected packageManagers.${name}.installCommand to be a non-empty array`);
    }
  }

  if (!config.licenseTypes[config.defaultLicense]) {
    throw new Error(`defaultLicense ${config.defaultLicense} is not present in licenseTypes`);
  }

  return config;
};

const nodeChoices = (config) =>
  Object.keys(config.nodeTargets)
    .sort((left, right) => Number(right) - Number(left))
    .map((value) => ({ label: value, value }));

module.exports = {
  loadConfig,
  nodeChoices,
};
