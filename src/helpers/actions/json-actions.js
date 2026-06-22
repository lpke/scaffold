'use strict';

const { fileExists, readText } = require('../../detect');
const { parseJson } = require('../../json');
const { formatJson } = require('../../json-format');
const { getPointer, removePointer, setPointer } = require('./json-pointer');
const { normalizeActionPath } = require('./paths');
const { resolveJsonValue } = require('./content');

const isPlainObject = (value) =>
  value != null && typeof value === 'object' && !Array.isArray(value);

const deepMerge = (target, source, { overwrite = true } = {}) => {
  for (const [key, value] of Object.entries(source)) {
    if (isPlainObject(value) && isPlainObject(target[key])) {
      deepMerge(target[key], value, { overwrite });
    } else if (overwrite || target[key] == null) {
      target[key] = value;
    }
  }
  return target;
};

const readJsonTarget = async (workspace, action) => {
  const targetPath = normalizeActionPath(action.path);
  const filePath = workspace.targetPath(targetPath);
  if (!(await fileExists(filePath))) {
    if (action.create) {
      return { targetPath, document: {} };
    }
    workspace.skipped.push(`${targetPath} absent`);
    workspace.mark(targetPath);
    return null;
  }
  return { targetPath, document: parseJson(await readText(filePath), filePath) };
};

const writeJsonTarget = async (workspace, targetPath, document) => {
  await workspace.write(targetPath, formatJson(document), { overwrite: true });
};

const applyJsonSet = async ({ workspace, action, context }) => {
  const target = await readJsonTarget(workspace, action);
  if (!target) return;
  const next = setPointer(
    target.document,
    action.pointer ?? '',
    resolveJsonValue(action, context),
    { create: action.create !== false },
  );
  await writeJsonTarget(workspace, target.targetPath, next);
};

const applyJsonMerge = async ({ workspace, action, context }) => {
  const target = await readJsonTarget(workspace, { ...action, create: action.create ?? true });
  if (!target) return;
  const value = resolveJsonValue(action, context);
  if (!isPlainObject(value)) {
    throw new Error('json.merge value must be an object');
  }
  const next = action.pointer
    ? setPointer(
        target.document,
        action.pointer,
        deepMerge(getPointer(target.document, action.pointer) ?? {}, value, {
          overwrite: action.overwrite ?? true,
        }),
        { create: true },
      )
    : deepMerge(target.document, value, { overwrite: action.overwrite ?? true });
  await writeJsonTarget(workspace, target.targetPath, next);
};

const applyJsonDelete = async ({ workspace, action }) => {
  const target = await readJsonTarget(workspace, action);
  if (!target) return;
  await writeJsonTarget(workspace, target.targetPath, removePointer(target.document, action.pointer));
};

const applyJsonPatch = async ({ workspace, action, context }) => {
  const target = await readJsonTarget(workspace, action);
  if (!target) return;
  let document = target.document;
  for (const operation of action.patch ?? []) {
    if (operation.op === 'remove') {
      document = removePointer(document, operation.path);
    } else if (operation.op === 'add' || operation.op === 'replace') {
      document = setPointer(document, operation.path, resolveJsonValue(operation, context));
    } else if (operation.op === 'copy') {
      const value = structuredClone(getPointer(document, operation.from));
      document = setPointer(document, operation.path, value);
    } else if (operation.op === 'move') {
      const value = structuredClone(getPointer(document, operation.from));
      document = removePointer(document, operation.from);
      document = setPointer(document, operation.path, value);
    } else if (operation.op === 'test') {
      const actual = JSON.stringify(getPointer(document, operation.path));
      const expected = JSON.stringify(resolveJsonValue(operation, context));
      if (actual !== expected) {
        throw new Error(`JSON patch test failed for ${operation.path}`);
      }
    } else {
      throw new Error(`Unsupported JSON patch op: ${operation.op}`);
    }
  }
  await writeJsonTarget(workspace, target.targetPath, document);
};

module.exports = {
  applyJsonDelete,
  applyJsonMerge,
  applyJsonPatch,
  applyJsonSet,
  deepMerge,
};
