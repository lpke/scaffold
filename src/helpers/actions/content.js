'use strict';

const { readAsset } = require('../../assets');

const TOKEN = /{{([A-Z][A-Z0-9_]*)}}/g;

const renderString = (source, values = {}) =>
  source.replace(TOKEN, (match, key) => {
    if (!(key in values)) {
      throw new Error(`Template token ${match} has no value`);
    }
    return String(values[key]);
  });

const renderValue = (value, values = {}) => {
  if (typeof value === 'string') {
    return renderString(value, values);
  }
  if (Array.isArray(value)) {
    return value.map((item) => renderValue(item, values));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, renderValue(item, values)]),
    );
  }
  return value;
};

const contentValues = (action, context) => ({
  ...(context.values ?? {}),
  ...(action.values ?? {}),
});

const resolveContent = async (action, context, { required = true } = {}) => {
  let content = null;
  if (typeof action.content === 'string') {
    content = action.content;
  } else if (typeof action.template === 'string') {
    content = await readAsset(`templates/${action.template}`);
  } else if (typeof action.asset === 'string') {
    content = await readAsset(action.asset);
  }

  if (content == null) {
    if (!required) {
      return null;
    }
    throw new Error(`Action ${action.type} needs content, template, or asset`);
  }
  return action.render === false ? content : renderString(content, contentValues(action, context));
};

const resolveJsonValue = (action, context, key = 'value') => {
  if (!(key in action)) {
    throw new Error(`Action ${action.type} needs ${key}`);
  }
  return action.render === false
    ? action[key]
    : renderValue(action[key], contentValues(action, context));
};

module.exports = {
  renderString,
  renderValue,
  resolveContent,
  resolveJsonValue,
};
