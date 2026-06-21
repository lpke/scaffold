'use strict';

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const wrap = (code, value) => (useColor ? `\u001b[${code}m${value}\u001b[0m` : value);

const color = {
  blue: (value) => wrap('34', value),
  cyan: (value) => wrap('36', value),
  dim: (value) => wrap('2', value),
  green: (value) => wrap('32', value),
  red: (value) => wrap('31', value),
  yellow: (value) => wrap('33', value),
  bold: (value) => wrap('1', value),
};

const symbol = {
  active: '◆',
  done: '◇',
  top: '┌',
  line: '│',
  end: '└',
  selected: '●',
  unselected: '○',
  checked: '■',
  unchecked: '□',
};

const hint = (value) => color.dim(value);
const activeLabel = (label) => color.bold(label);
const inactiveLabel = (label) => color.dim(label);
const choiceHint = (choice) => (choice.hint ? ` ${hint(`(${choice.hint})`)}` : '');

module.exports = {
  activeLabel,
  choiceHint,
  color,
  hint,
  inactiveLabel,
  symbol,
};
