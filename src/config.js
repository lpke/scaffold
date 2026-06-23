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
  requireObject(config.seedCommands, 'seedCommands');
  requireObject(config.licenseTypes, 'licenseTypes');
  requireString(config.defaultLicense, 'defaultLicense');
  if (config.featureConflicts !== undefined && !Array.isArray(config.featureConflicts)) {
    throw new Error('Expected featureConflicts to be an array in config.json');
  }

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

  for (const [name, seed] of Object.entries(config.seedCommands)) {
    requireObject(seed, `seedCommands.${name}`);
    requireString(seed.label, `seedCommands.${name}.label`);
    requireString(seed.versionPackage, `seedCommands.${name}.versionPackage`);
    requireString(seed.commandPackage, `seedCommands.${name}.commandPackage`);
    if (seed.frameworkPackage !== undefined) {
      requireString(seed.frameworkPackage, `seedCommands.${name}.frameworkPackage`);
    }
    if (seed.commandArgs !== undefined && !Array.isArray(seed.commandArgs)) {
      throw new Error(`Expected seedCommands.${name}.commandArgs to be an array`);
    }
  }

  for (const [index, conflict] of Object.entries(config.featureConflicts || [])) {
    requireObject(conflict, `featureConflicts.${index}`);
    if (conflict.features !== undefined) {
      if (
        !Array.isArray(conflict.features) ||
        conflict.features.length < 2 ||
        conflict.features.some((feature) => typeof feature !== 'string' || !feature.trim())
      ) {
        throw new Error(`Expected featureConflicts.${index}.features to be an array of feature names`);
      }
    }
    if (conflict.when !== undefined) {
      requireObject(conflict.when, `featureConflicts.${index}.when`);
      for (const [feature, value] of Object.entries(conflict.when)) {
        if (!feature.trim() || typeof value !== 'boolean') {
          throw new Error(`Expected featureConflicts.${index}.when values to be booleans`);
        }
      }
    }
    if (conflict.features === undefined && conflict.when === undefined) {
      throw new Error(`Expected featureConflicts.${index}.features or .when`);
    }
    if (
      conflict.foundations !== undefined &&
      (!Array.isArray(conflict.foundations) ||
        conflict.foundations.some((foundation) => typeof foundation !== 'string' || !foundation.trim()))
    ) {
      throw new Error(`Expected featureConflicts.${index}.foundations to be an array of names`);
    }
    requireString(conflict.message, `featureConflicts.${index}.message`);
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
