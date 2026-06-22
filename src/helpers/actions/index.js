'use strict';

const { applyAction, applyActions } = require('./executor');
const { applyActionManifest } = require('./manifest');

module.exports = {
  applyAction,
  applyActionManifest,
  applyActions,
};
