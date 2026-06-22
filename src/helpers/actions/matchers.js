'use strict';

const { isSameOrDescendant, normalizeActionPath } = require('./paths');

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const globToRegExp = (glob) => {
  let source = '^';
  for (let index = 0; index < glob.length; index += 1) {
    const char = glob[index];
    const next = glob[index + 1];
    if (char === '*' && next === '*') {
      source += '.*';
      index += 1;
    } else if (char === '*') {
      source += '[^/]*';
    } else if (char === '?') {
      source += '[^/]';
    } else {
      source += escapeRegExp(char);
    }
  }
  return new RegExp(`${source}$`);
};

const normalizeRulePath = (value) =>
  normalizeActionPath(value, { allowRoot: true, label: 'path rule' });

const matchesPathRule = (relativePath, rule) => {
  const candidate = normalizeRulePath(relativePath);
  if (typeof rule === 'string') {
    return isSameOrDescendant(candidate, normalizeRulePath(rule));
  }
  if (!rule || typeof rule !== 'object') {
    throw new Error('Path rule must be a string or object');
  }
  if (rule.path) {
    return isSameOrDescendant(candidate, normalizeRulePath(rule.path));
  }
  if (rule.exact) {
    return candidate === normalizeRulePath(rule.exact);
  }
  if (rule.prefix) {
    return candidate.startsWith(normalizeRulePath(rule.prefix));
  }
  if (rule.regex) {
    return new RegExp(rule.regex, rule.flags ?? '').test(candidate);
  }
  if (rule.glob) {
    return globToRegExp(rule.glob).test(candidate);
  }
  throw new Error('Path rule needs path, exact, prefix, regex, or glob');
};

const matchesAnyPathRule = (relativePath, rules = []) =>
  rules.some((rule) => matchesPathRule(relativePath, rule));

module.exports = {
  escapeRegExp,
  globToRegExp,
  matchesAnyPathRule,
  matchesPathRule,
};
