'use strict';

const decodeSegment = (segment) => segment.replace(/~1/g, '/').replace(/~0/g, '~');

const pointerSegments = (pointer) => {
  if (pointer == null || pointer === '') {
    return [];
  }
  if (typeof pointer !== 'string' || !pointer.startsWith('/')) {
    throw new Error(`JSON pointer must start with /: ${pointer}`);
  }
  return pointer.slice(1).split('/').map(decodeSegment);
};

const isObjectLike = (value) => value && typeof value === 'object';

const getParent = (document, pointer, { create = false } = {}) => {
  const segments = pointerSegments(pointer);
  if (segments.length === 0) {
    return { parent: null, key: null };
  }

  let parent = document;
  for (const segment of segments.slice(0, -1)) {
    if (!isObjectLike(parent)) {
      throw new Error(`Cannot traverse JSON pointer ${pointer}`);
    }
    if (!(segment in parent)) {
      if (!create) {
        throw new Error(`JSON pointer does not exist: ${pointer}`);
      }
      parent[segment] = {};
    }
    parent = parent[segment];
  }
  return { parent, key: segments[segments.length - 1] };
};

const getPointer = (document, pointer) => {
  let current = document;
  for (const segment of pointerSegments(pointer)) {
    if (!isObjectLike(current) || !(segment in current)) {
      return undefined;
    }
    current = current[segment];
  }
  return current;
};

const setPointer = (document, pointer, value, { create = true } = {}) => {
  const target = getParent(document, pointer, { create });
  if (target.parent == null) {
    return value;
  }
  if (Array.isArray(target.parent)) {
    if (target.key === '-') {
      target.parent.push(value);
    } else {
      target.parent[Number(target.key)] = value;
    }
  } else {
    target.parent[target.key] = value;
  }
  return document;
};

const removePointer = (document, pointer) => {
  const { parent, key } = getParent(document, pointer);
  if (parent == null) {
    return undefined;
  }
  if (Array.isArray(parent)) {
    parent.splice(Number(key), 1);
  } else {
    delete parent[key];
  }
  return document;
};

module.exports = {
  getPointer,
  pointerSegments,
  removePointer,
  setPointer,
};
