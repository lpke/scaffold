'use strict';

const isJsonScalar = (value) =>
  value == null || ['boolean', 'number', 'string'].includes(typeof value);

const formatJsonValue = (value, level = 0) => {
  const indent = '  '.repeat(level);
  const nextIndent = '  '.repeat(level + 1);

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '[]';
    }
    if (value.every(isJsonScalar)) {
      const inline = `[${value.map((item) => JSON.stringify(item)).join(', ')}]`;
      if (indent.length + inline.length <= 60) {
        return inline;
      }
    }
    return `[\n${value.map((item) => `${nextIndent}${formatJsonValue(item, level + 1)}`).join(',\n')}\n${indent}]`;
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value);
    if (entries.length === 0) {
      return '{}';
    }
    return `{\n${entries
      .map(([key, item]) => `${nextIndent}${JSON.stringify(key)}: ${formatJsonValue(item, level + 1)}`)
      .join(',\n')}\n${indent}}`;
  }

  return JSON.stringify(value);
};

const formatJson = (value) => `${formatJsonValue(value)}\n`;

module.exports = {
  formatJson,
};
