'use strict';

const stripJsonComments = (source) => {
  let output = '';
  let inString = false;
  let quote = '';
  let escaped = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (inString) {
      output += char;
      escaped = !escaped && char === '\\';
      if (!escaped && char === quote) {
        inString = false;
        quote = '';
      } else if (char !== '\\') {
        escaped = false;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      inString = true;
      quote = char;
      output += char;
      continue;
    }
    if (char === '/' && next === '/') {
      while (index < source.length && source[index] !== '\n') {
        index += 1;
      }
      output += '\n';
      continue;
    }
    if (char === '/' && next === '*') {
      index += 2;
      while (index < source.length && !(source[index] === '*' && source[index + 1] === '/')) {
        index += 1;
      }
      index += 1;
      continue;
    }
    output += char;
  }

  return output.replace(/,\s*([}\]])/g, '$1');
};

const parseJson = (source, label) => {
  try {
    return JSON.parse(stripJsonComments(source));
  } catch (error) {
    throw new Error(`Invalid JSON in ${label}: ${error.message}`);
  }
};

module.exports = {
  parseJson,
};
