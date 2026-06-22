'use strict';

const { fileExists } = require('../../detect');
const { normalizeActionPath } = require('./paths');

const compare = (actual, condition) => {
  if ('equals' in condition) {
    return actual === condition.equals;
  }
  if ('notEquals' in condition) {
    return actual !== condition.notEquals;
  }
  if ('includes' in condition) {
    return Array.isArray(actual) && actual.includes(condition.includes);
  }
  return Boolean(actual);
};

const evaluateCondition = async (condition, context) => {
  if (condition == null) {
    return true;
  }
  if (typeof condition === 'string') {
    return Boolean(context.answers?.[condition]);
  }
  if (typeof condition === 'boolean') {
    return condition;
  }
  if (Array.isArray(condition)) {
    for (const item of condition) {
      if (!(await evaluateCondition(item, context))) {
        return false;
      }
    }
    return true;
  }
  if (condition.all) {
    for (const item of condition.all) {
      if (!(await evaluateCondition(item, context))) {
        return false;
      }
    }
    return true;
  }
  if (condition.any) {
    for (const item of condition.any) {
      if (await evaluateCondition(item, context)) {
        return true;
      }
    }
    return false;
  }
  if (condition.not) {
    return !(await evaluateCondition(condition.not, context));
  }
  if (condition.answer) {
    return compare(context.answers?.[condition.answer], condition);
  }
  if (condition.value) {
    return compare(context.values?.[condition.value], condition);
  }
  if (condition.fileExists) {
    const filePath = normalizeActionPath(condition.fileExists, { label: 'fileExists' });
    return fileExists(context.workspace.targetPath(filePath));
  }
  if (condition.fileMissing) {
    const filePath = normalizeActionPath(condition.fileMissing, { label: 'fileMissing' });
    return !(await fileExists(context.workspace.targetPath(filePath)));
  }
  throw new Error(`Unknown action condition: ${JSON.stringify(condition)}`);
};

const shouldRunAction = async (action, context) => {
  if (!(await evaluateCondition(action.when, context))) {
    return false;
  }
  if (action.unless && (await evaluateCondition(action.unless, context))) {
    return false;
  }
  return true;
};

module.exports = {
  evaluateCondition,
  shouldRunAction,
};
