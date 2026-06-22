'use strict';

const { fileExists, readText } = require('../../detect');
const { resolveContent } = require('./content');
const { normalizeActionPath } = require('./paths');

const ensureFileText = async (workspace, action) => {
  const targetPath = normalizeActionPath(action.path);
  const filePath = workspace.targetPath(targetPath);
  if (!(await fileExists(filePath))) {
    if (action.create) {
      await workspace.write(targetPath, '', { overwrite: false });
      return { targetPath, text: '' };
    }
    workspace.skipped.push(`${targetPath} absent`);
    workspace.mark(targetPath);
    return null;
  }
  return { targetPath, text: await readText(filePath) };
};

const actionSkipContains = (text, action) => {
  const values = Array.isArray(action.skipIfContains)
    ? action.skipIfContains
    : action.skipIfContains
      ? [action.skipIfContains]
      : [];
  return values.some((value) => text.includes(value));
};

const replacementRegExp = (replacement) => {
  if (!replacement.regex) {
    return null;
  }
  const flags = replacement.flags ?? (replacement.all === false ? '' : 'g');
  return new RegExp(replacement.regex, flags.includes('g') || replacement.all === false ? flags : `${flags}g`);
};

const applySingleReplacement = (text, replacement) => {
  const value = replacement.replace ?? '';
  const regex = replacementRegExp(replacement);
  if (regex) {
    const next = text.replace(regex, value);
    return { text: next, changed: next !== text };
  }
  const match = replacement.match;
  if (typeof match !== 'string') {
    throw new Error('text replacement needs match or regex');
  }
  if (!text.includes(match)) {
    return { text, changed: false };
  }
  if (replacement.all === false) {
    return { text: text.replace(match, value), changed: true };
  }
  return { text: text.split(match).join(value), changed: true };
};

const applyTextReplace = async ({ workspace, action }) => {
  const target = await ensureFileText(workspace, action);
  if (!target) return;
  if (actionSkipContains(target.text, action)) {
    workspace.skipped.push(`${target.targetPath} already has requested text`);
    workspace.mark(target.targetPath);
    return;
  }

  const replacements = action.replacements ?? [action];
  let next = target.text;
  let changed = false;
  for (const replacement of replacements) {
    const result = applySingleReplacement(next, replacement);
    next = result.text;
    changed ||= result.changed;
  }
  if (!changed) {
    if (action.required) {
      throw new Error(`${target.targetPath} missing required text replacement`);
    }
    workspace.skipped.push(`${target.targetPath} missing override match`);
    workspace.mark(target.targetPath);
    return;
  }
  await workspace.write(target.targetPath, next, { overwrite: true });
};

const applyTextAppend = async ({ workspace, action, context }) => {
  const target = await ensureFileText(workspace, { ...action, create: action.create ?? true });
  if (!target) return;
  if (actionSkipContains(target.text, action)) {
    workspace.skipped.push(`${target.targetPath} already has requested text`);
    workspace.mark(target.targetPath);
    return;
  }
  await workspace.write(target.targetPath, `${target.text}${await resolveContent(action, context)}`, {
    overwrite: true,
  });
};

const applyTextPrepend = async ({ workspace, action, context }) => {
  const target = await ensureFileText(workspace, { ...action, create: action.create ?? true });
  if (!target) return;
  if (actionSkipContains(target.text, action)) {
    workspace.skipped.push(`${target.targetPath} already has requested text`);
    workspace.mark(target.targetPath);
    return;
  }
  await workspace.write(target.targetPath, `${await resolveContent(action, context)}${target.text}`, {
    overwrite: true,
  });
};

const insertAtMatch = (text, action, content, after) => {
  const regex = replacementRegExp(action);
  if (regex) {
    let changed = false;
    const next = text.replace(regex, (match) => {
      changed = true;
      return after ? `${match}${content}` : `${content}${match}`;
    });
    return { text: next, changed };
  }
  if (!text.includes(action.match)) {
    return { text, changed: false };
  }
  const index = text.indexOf(action.match);
  const offset = after ? action.match.length : 0;
  return {
    text: `${text.slice(0, index + offset)}${content}${text.slice(index + offset)}`,
    changed: true,
  };
};

const applyTextInsert = async ({ workspace, action, context, after }) => {
  const target = await ensureFileText(workspace, action);
  if (!target) return;
  if (actionSkipContains(target.text, action)) {
    workspace.skipped.push(`${target.targetPath} already has requested text`);
    workspace.mark(target.targetPath);
    return;
  }
  const result = insertAtMatch(target.text, action, await resolveContent(action, context), after);
  if (!result.changed) {
    if (action.required) {
      throw new Error(`${target.targetPath} missing insertion match`);
    }
    workspace.skipped.push(`${target.targetPath} missing insertion match`);
    workspace.mark(target.targetPath);
    return;
  }
  await workspace.write(target.targetPath, result.text, { overwrite: true });
};

const applyTextMergeLines = async ({ workspace, action }) => {
  await workspace.mergeLines(normalizeActionPath(action.path), action.lines ?? [], {
    existingHeader: action.existingHeader ?? null,
  });
};

const applyTextRemoveLines = async ({ workspace, action }) => {
  const target = await ensureFileText(workspace, action);
  if (!target) return;
  const exact = new Set(action.lines ?? []);
  const regexes = (action.regexes ?? []).map((regex) => new RegExp(regex));
  const next = target.text
    .split(/\r?\n/)
    .filter((line) => !exact.has(line.trim()) && !regexes.some((regex) => regex.test(line)))
    .join('\n');
  const normalized = target.text.endsWith('\n') ? `${next}\n` : next;
  if (normalized === target.text) {
    workspace.skipped.push(`${target.targetPath} no matching lines`);
    workspace.mark(target.targetPath);
    return;
  }
  await workspace.write(target.targetPath, normalized, { overwrite: true });
};

const lineKey = (line) => {
  const match = line.match(/^\s*([^#;][^=:#\s]*)\s*[=:]/);
  return match?.[1] ?? null;
};

const propertyLine = (key, value, separator) => `${key}${separator}${value}`;

const applyTextSetProperties = async ({ workspace, action }) => {
  const target = await ensureFileText(workspace, { ...action, create: action.create ?? true });
  if (!target) return;
  const properties = action.properties ?? {};
  const separator = action.separator ?? ' = ';
  const nextLines = [];
  const seen = new Set();

  for (const line of target.text.split(/\r?\n/)) {
    const key = lineKey(line);
    if (key && key in properties) {
      nextLines.push(propertyLine(key, properties[key], separator));
      seen.add(key);
    } else {
      nextLines.push(line);
    }
  }

  const insertLines = Object.entries(properties)
    .filter(([key]) => !seen.has(key))
    .map(([key, value]) => propertyLine(key, value, separator));
  const hadTrailingNewline = target.text.endsWith('\n');
  if (insertLines.length > 0) {
    while (nextLines.length > 0 && nextLines[nextLines.length - 1] === '') {
      nextLines.pop();
    }
    if (nextLines.length > 0 && action.blankLineBeforeInsert) {
      nextLines.push('');
    }
    nextLines.push(...insertLines);
  }

  const next = `${nextLines.join('\n')}${hadTrailingNewline || action.insertFinalNewline ? '\n' : ''}`;
  if (next === target.text) {
    workspace.skipped.push(`${target.targetPath} properties already match`);
    workspace.mark(target.targetPath);
    return;
  }
  await workspace.write(target.targetPath, next, { overwrite: true });
};

const applyTextEnsureTrailingNewline = async ({ workspace, action }) => {
  const target = await ensureFileText(workspace, action);
  if (!target) return;
  if (target.text.endsWith('\n')) {
    workspace.skipped.push(`${target.targetPath} already has trailing newline`);
    workspace.mark(target.targetPath);
    return;
  }
  await workspace.write(target.targetPath, `${target.text}\n`, { overwrite: true });
};

module.exports = {
  applyTextAppend,
  applyTextEnsureTrailingNewline,
  applyTextInsert,
  applyTextMergeLines,
  applyTextPrepend,
  applyTextRemoveLines,
  applyTextSetProperties,
  applyTextReplace,
};
