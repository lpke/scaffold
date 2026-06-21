'use strict';

const readline = require('node:readline/promises');

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const wrap = (code, value) => (useColor ? `\u001b[${code}m${value}\u001b[0m` : value);

const color = {
  cyan: (value) => wrap('36', value),
  dim: (value) => wrap('2', value),
  green: (value) => wrap('32', value),
  red: (value) => wrap('31', value),
  yellow: (value) => wrap('33', value),
  bold: (value) => wrap('1', value),
};

const createPrompter = () =>
  readline.createInterface({ input: process.stdin, output: process.stdout });

const promptLine = async (rl, message) => {
  console.log('');
  return rl.question(color.cyan(message));
};

const promptYesNo = async (rl, message, defaultValue) => {
  const suffix = defaultValue ? 'Y/n' : 'y/N';
  while (true) {
    const answer = (await promptLine(rl, `${message} (${suffix}) `)).trim().toLowerCase();
    if (!answer) {
      return defaultValue;
    }
    if (['y', 'yes'].includes(answer)) {
      return true;
    }
    if (['n', 'no'].includes(answer)) {
      return false;
    }
    console.log(color.yellow('Enter y or n.'));
  }
};

const promptChoice = async (rl, message, choices, defaultValue) => {
  const labels = choices
    .map((choice, index) => {
      const marker = choice.value === defaultValue ? color.green(' default') : '';
      return `  ${index + 1}. ${choice.label}${marker}`;
    })
    .join('\n');

  while (true) {
    const answer = (
      await promptLine(rl, `${message}\n${labels}\n> `)
    ).trim();
    if (!answer) {
      return defaultValue;
    }
    const number = Number(answer);
    if (Number.isInteger(number) && choices[number - 1]) {
      return choices[number - 1].value;
    }
    const byValue = choices.find((choice) => choice.value === answer);
    if (byValue) {
      return byValue.value;
    }
    console.log(color.yellow('Pick one listed value.'));
  }
};

const promptText = async (rl, message, defaultValue, validate = () => true) => {
  while (true) {
    const suffix = defaultValue ? ` ${color.dim(`[${defaultValue}]`)}` : '';
    const answer = (await promptLine(rl, `${message}${suffix}\n> `)).trim();
    const value = answer || defaultValue;
    const valid = validate(value);
    if (valid === true) {
      return value;
    }
    console.log(color.yellow(valid || 'Invalid value.'));
  }
};

module.exports = {
  color,
  createPrompter,
  promptChoice,
  promptText,
  promptYesNo,
};
