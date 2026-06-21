'use strict';

const readline = require('node:readline');
const readlinePromises = require('node:readline/promises');

const { color, hint, symbol } = require('./color');

const rail = () => color.dim(symbol.line);
const activeRail = () => color.cyan(symbol.line);
const activeEnd = () => color.cyan(symbol.end);
const end = () => color.dim(symbol.end);

const createPrompter = () => {
  const input = process.stdin;
  const output = process.stdout;
  const rl = readlinePromises.createInterface({ input, output });
  const close = rl.close.bind(rl);
  rl.input = input;
  rl.output = output;
  if (output.isTTY) {
    let cursorHidden = true;
    const restoreCursor = () => {
      if (!cursorHidden) {
        return;
      }
      cursorHidden = false;
      output.write('\u001b[?25h');
    };
    output.write('\u001b[?25l');
    process.once('exit', restoreCursor);
    rl.close = () => {
      process.removeListener('exit', restoreCursor);
      restoreCursor();
      return close();
    };
  }
  return rl;
};

const canUseKeys = (rl) => Boolean(rl?.input?.isTTY && rl?.output?.isTTY);

const clearRendered = (output, renderedLines) => {
  if (renderedLines <= 0) {
    return;
  }
  readline.clearLine(output, 0);
  readline.cursorTo(output, 0);
  readline.moveCursor(output, 0, -renderedLines);
  readline.clearScreenDown(output);
};

const writeLines = (output, lines) => {
  output.write(`${lines.join('\n')}\n`);
  return lines.length;
};

const renderBlock = (output, renderedLines, lines) => {
  clearRendered(output, renderedLines);
  return writeLines(output, lines);
};

const promptError = () => new Error('Cancelled');

const questionLine = (message, help) =>
  `${color.cyan(symbol.active)}  ${message}${help ? ` ${hint(help)}` : ''}`;

const doneLines = (message, value) => [
  `${color.green(symbol.done)}  ${message}`,
  `${rail()}  ${hint(value || 'none')}`,
  rail(),
];

const intro = (message) => {
  console.log(`${color.dim(symbol.top)}  ${color.cyan(message)}`);
  console.log(rail());
};

const outro = (message) => {
  console.log(`${color.green(symbol.done)} ${message}`);
};

module.exports = {
  canUseKeys,
  clearRendered,
  createPrompter,
  doneLines,
  activeEnd,
  activeRail,
  end,
  intro,
  outro,
  promptError,
  questionLine,
  rail,
  readline,
  renderBlock,
  writeLines,
};
