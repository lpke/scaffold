'use strict';

const path = require('node:path');

const DRIVE_PATH = /^[A-Za-z]:[\\/]/;

const normalizeActionPath = (value, { allowRoot = false, label = 'path' } = {}) => {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Action ${label} must be a non-empty relative path`);
  }
  if (path.posix.isAbsolute(value) || path.win32.isAbsolute(value) || DRIVE_PATH.test(value)) {
    throw new Error(`Action ${label} must be relative: ${value}`);
  }

  const normalized = path.posix.normalize(value.replace(/\\/g, '/'));
  if (normalized === '..' || normalized.startsWith('../')) {
    throw new Error(`Action ${label} cannot escape the target directory: ${value}`);
  }
  if (normalized === '.') {
    if (!allowRoot) {
      throw new Error(`Action ${label} cannot be the project root`);
    }
    return '.';
  }
  return normalized.replace(/\/+$/, '');
};

const joinActionPath = (...parts) => normalizeActionPath(path.posix.join(...parts), {
  allowRoot: true,
});

const isSameOrDescendant = (candidate, ancestor) =>
  candidate === ancestor || candidate.startsWith(`${ancestor}/`);

module.exports = {
  isSameOrDescendant,
  joinActionPath,
  normalizeActionPath,
};
