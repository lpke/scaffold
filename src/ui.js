'use strict';

const readline = require('node:readline');
const readlinePromises = require('node:readline/promises');

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

const createPrompter = () => {
  const input = process.stdin;
  const output = process.stdout;
  const rl = readlinePromises.createInterface({ input, output });
  rl.input = input;
  rl.output = output;
  return rl;
};

const promptLine = async (rl, message) => {
  console.log('');
  return rl.question(color.cyan(message));
};

const promptYesNo = async (rl, message, defaultValue) => {
  const suffix = defaultValue ? 'Y/n' : 'y/N';
  while (true) {
    const answer = (await promptLine(rl, `${message} ${color.blue(`(${suffix})`)} `))
      .trim()
      .toLowerCase();
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

const formatChoiceLine = ({ choice, defaultValue, index, selected }) => {
  const pointer = selected ? color.green('>') : ' ';
  const marker = choice.value === defaultValue ? ` ${color.green('default')}` : '';
  return `${pointer} ${color.blue(`${index + 1}.`)} ${color.blue(choice.label)}${marker}`;
};

const promptChoiceKeys = (rl, message, choices, defaultValue) => {
  const input = rl.input;
  const output = rl.output;
  if (!input?.isTTY || !output?.isTTY) {
    return null;
  }

  let selected = choices.findIndex((choice) => choice.value === defaultValue);
  if (selected < 0) {
    selected = 0;
  }
  let renderedLines = 0;

  return new Promise((resolve, reject) => {
    let done = false;
    const wasRaw = input.isRaw;

    const cleanup = () => {
      input.off('keypress', onKeypress);
      if (input.isTTY) {
        input.setRawMode(Boolean(wasRaw));
      }
      output.write('\n');
    };

    const finish = (value) => {
      if (done) {
        return;
      }
      done = true;
      cleanup();
      resolve(value);
    };

    const render = () => {
      if (renderedLines > 0) {
        readline.moveCursor(output, 0, -renderedLines);
        readline.clearScreenDown(output);
      }
      const lines = [
        '',
        color.cyan(message),
        ...choices.map((choice, index) =>
          formatChoiceLine({ choice, defaultValue, index, selected: index === selected }),
        ),
        color.dim('Use arrow keys, number, or Enter.'),
      ];
      output.write(`${lines.join('\n')}\n`);
      renderedLines = lines.length;
    };

    const onKeypress = (str, key = {}) => {
      if (key.ctrl && key.name === 'c') {
        done = true;
        cleanup();
        reject(new Error('Cancelled'));
        return;
      }
      if (key.name === 'up') {
        selected = (selected - 1 + choices.length) % choices.length;
        render();
        return;
      }
      if (key.name === 'down') {
        selected = (selected + 1) % choices.length;
        render();
        return;
      }
      if (key.name === 'return' || key.name === 'enter') {
        finish(choices[selected].value);
        return;
      }
      if (/^[1-9]$/.test(str)) {
        const index = Number(str) - 1;
        if (choices[index]) {
          finish(choices[index].value);
        }
      }
    };

    readline.emitKeypressEvents(input, rl);
    input.setRawMode(true);
    input.resume();
    input.on('keypress', onKeypress);
    render();
  });
};

const promptChoice = async (rl, message, choices, defaultValue) => {
  if (choices.length === 0) {
    throw new Error(`No choices available for prompt: ${message}`);
  }

  const keyChoice = promptChoiceKeys(rl, message, choices, defaultValue);
  if (keyChoice) {
    return keyChoice;
  }

  const labels = choices
    .map((choice, index) =>
      formatChoiceLine({ choice, defaultValue, index, selected: false }),
    )
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
