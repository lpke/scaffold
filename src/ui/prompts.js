'use strict';

const {
  activeLabel,
  choiceHint,
  color,
  hint,
  inactiveLabel,
  symbol,
} = require('./color');
const {
  canUseKeys,
  activeEnd,
  activeRail,
  clearRendered,
  doneLines,
  promptBack,
  promptError,
  questionLine,
  readline,
  renderBlock,
} = require('./frame');

const withKeypress = ({ rl, input, onKeypress, reject }) => {
  const wasRaw = input.isRaw;
  const cleanup = () => {
    input.off('keypress', onKeypress);
    input.setRawMode(Boolean(wasRaw));
  };

  readline.emitKeypressEvents(input, rl);
  input.setRawMode(true);
  input.resume();
  input.on('keypress', onKeypress);

  return {
    cancel: () => {
      cleanup();
      reject(promptError());
    },
    back: () => {
      cleanup();
      reject(promptBack());
    },
    cleanup,
  };
};

const moveIndex = (index, length, direction) => (index + direction + length) % length;

const isUp = (str, key = {}) => key.name === 'up' || str === 'k';
const isDown = (str, key = {}) => key.name === 'down' || str === 'j';
const isLeft = (str, key = {}) => key.name === 'left' || str === 'h';
const isRight = (str, key = {}) => key.name === 'right' || str === 'l';
const isEnter = (key = {}) => key.name === 'return' || key.name === 'enter';
const isEscape = (key = {}) => key.name === 'escape';
const isCtrlC = (key = {}) => key.ctrl && key.name === 'c';
const isPrintable = (str) => Boolean(str && str.length === 1 && str >= ' ');

const fallbackValueList = (choices) =>
  choices.map((choice) => `${choice.value}: ${choice.label}${choiceHint(choice)}`).join('\n');

const backHelp = '(ESC again to go back)';

const recordDonePrompt = (rl) => {
  rl.renderedPromptLines = (rl.renderedPromptLines || 0) + doneLines('', '').length;
};

const clearTextRendered = (output, renderedLines, cursorLineOffset = 0) => {
  if (renderedLines <= 0) {
    return;
  }
  readline.clearLine(output, 0);
  readline.cursorTo(output, 0);
  readline.moveCursor(output, 0, -(renderedLines - 1 + cursorLineOffset));
  readline.clearScreenDown(output);
};

const renderTextBlock = (output, renderedLines, lines, cursorLineOffset = 0) => {
  clearTextRendered(output, renderedLines, cursorLineOffset);
  output.write(lines.join('\n'));
  return lines.length;
};

const renderTextDone = (output, renderedLines, lines, cursorLineOffset = 0) => {
  clearTextRendered(output, renderedLines, cursorLineOffset);
  output.write(`${lines.join('\n')}\n`);
  return lines.length;
};

const promptTextKeys = (rl, message, defaultValue, validate = () => true, options = {}) => {
  if (!canUseKeys(rl)) {
    return null;
  }

  const input = rl.input;
  const output = rl.output;
  let value = '';
  let error = null;
  let renderedLines = 0;

  return new Promise((resolve, reject) => {
    let done = false;
    let controls;
    let cursorLineOffset = 0;
    let backPending = false;

    const render = () => {
      const hintLine = options.hintLine ?? (defaultValue ? hint(`(${defaultValue})`) : '');
      renderedLines = renderTextBlock(output, renderedLines, [
        ...(error ? [`${color.dim(symbol.line)}  ${color.red(error)}`] : []),
        questionLine(message, backPending ? backHelp : undefined),
        ...(hintLine ? [`${activeRail()}  ${hintLine}`] : []),
        `${activeEnd()}  ${value}`,
      ], cursorLineOffset);
      cursorLineOffset = 0;
    };

    const finish = async () => {
      const answer = (value || defaultValue).trim();
      const valid = await validate(answer);
      if (valid !== true) {
        error = valid || 'Invalid value.';
        value = '';
        render();
        return;
      }
      if (done) {
        return;
      }
      done = true;
      renderedLines = renderTextDone(output, renderedLines, doneLines(message, answer), cursorLineOffset);
      cursorLineOffset = 0;
      recordDonePrompt(rl);
      controls.cleanup();
      resolve(answer);
    };

    const onKeypress = (str, key = {}) => {
      if (isCtrlC(key)) {
        done = true;
        controls.cancel();
        return;
      }
      if (isEscape(key)) {
        if (backPending) {
          done = true;
          clearTextRendered(output, renderedLines);
          controls.back();
          return;
        }
        backPending = true;
        render();
        return;
      }
      backPending = false;
      if (isEnter(key)) {
        cursorLineOffset = 1;
        finish();
        return;
      }
      if (['backspace', 'delete'].includes(key.name)) {
        value = value.slice(0, -1);
        render();
        return;
      }
      if (isPrintable(str)) {
        value += str;
        render();
      }
    };

    output.write('\u001b[?25h\u001b[6 q');
    controls = withKeypress({
      rl,
      input,
      onKeypress,
      reject: (error) => {
        output.write('\u001b[?25l\u001b[0 q');
        reject(error);
      },
    });
    const cleanup = controls.cleanup;
    controls.cleanup = () => {
      output.write('\u001b[?25l\u001b[0 q');
      cleanup();
    };
    render();
  });
};

const promptText = async (rl, message, defaultValue, validate = () => true, options = {}) => {
  const keyText = promptTextKeys(rl, message, defaultValue, validate, options);
  if (keyText) {
    return keyText;
  }

  let error = null;
  while (true) {
    if (error) {
      console.log(`${color.dim(symbol.line)}  ${color.red(error)}`);
    }
    console.log(questionLine(message));
    const hintLine = options.hintLine ?? (defaultValue ? hint(`(${defaultValue})`) : '');
    const suffix = hintLine ? `  ${hintLine}` : '';
    const renderedLines = 3 + (error ? 1 : 0);
    rl.output?.write('\u001b[?25h\u001b[6 q');
    let answer;
    try {
      answer = (await rl.question(`${activeRail()}${suffix}\n${activeEnd()}  `)).trim();
    } finally {
      rl.output?.write('\u001b[?25l\u001b[0 q');
    }
    const value = answer || defaultValue;
    const valid = await validate(value);
    if (valid === true) {
      if (rl.output?.isTTY) {
        clearRendered(rl.output, renderedLines);
      }
      console.log(doneLines(message, value).join('\n'));
      recordDonePrompt(rl);
      return value;
    }
    error = valid || 'Invalid value.';
    if (rl.output?.isTTY) {
      clearRendered(rl.output, renderedLines);
    } else {
      console.log(`${color.dim(symbol.line)}  ${color.red(error)}`);
    }
  }
};

const promptYesNoKeys = (rl, message, defaultValue) => {
  if (!canUseKeys(rl)) {
    return null;
  }

  const input = rl.input;
  const output = rl.output;
  let selected = Boolean(defaultValue);
  let renderedLines = 0;

  return new Promise((resolve, reject) => {
    let done = false;
    let controls;
    let backPending = false;

    const finish = (value, submittedWithEnter = false) => {
      if (done) {
        return;
      }
      done = true;
      renderedLines = renderBlock(
        output,
        renderedLines + (submittedWithEnter ? 1 : 0),
        doneLines(message, value ? 'Yes' : 'No'),
      );
      recordDonePrompt(rl);
      controls.cleanup();
      resolve(value);
    };

    const option = (value, label) => {
      const active = selected === value;
      const marker = active ? color.cyan(symbol.selected) : color.dim(symbol.unselected);
      const text = active ? activeLabel(label) : inactiveLabel(label);
      return `${marker} ${text}`;
    };

    const render = () => {
      renderedLines = renderBlock(output, renderedLines, [
        questionLine(message, backPending ? backHelp : undefined),
        `${activeRail()}  ${option(true, 'Yes')} ${color.dim('/')} ${option(false, 'No')}`,
        activeEnd(),
      ]);
    };

    const onKeypress = (str, key = {}) => {
      if (isCtrlC(key)) {
        done = true;
        controls.cancel();
        return;
      }
      if (isEscape(key)) {
        if (backPending) {
          done = true;
          clearRendered(output, renderedLines);
          controls.back();
          return;
        }
        backPending = true;
        render();
        return;
      }
      backPending = false;
      if (isLeft(str, key) || isRight(str, key) || ['space', 'tab'].includes(key.name)) {
        selected = !selected;
        render();
        return;
      }
      if (str === 'y') {
        finish(true);
        return;
      }
      if (str === 'n') {
        finish(false);
        return;
      }
      if (isEnter(key)) {
        finish(selected, true);
        return;
      }
      if (isPrintable(str)) {
        render();
      }
    };

    controls = withKeypress({ rl, input, onKeypress, reject });
    render();
  });
};

const promptYesNo = async (rl, message, defaultValue) => {
  const keyChoice = promptYesNoKeys(rl, message, defaultValue);
  if (keyChoice) {
    return keyChoice;
  }

  const suffix = defaultValue ? 'Y/n' : 'y/N';
  while (true) {
    const answer = (await promptText(rl, `${message} ${color.blue(`(${suffix})`)}`, '', () => true))
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

const promptChoiceKeys = (rl, message, choices, defaultValue) => {
  if (!canUseKeys(rl)) {
    return null;
  }

  const input = rl.input;
  const output = rl.output;
  let selected = choices.findIndex((choice) => choice.value === defaultValue);
  if (selected < 0) {
    selected = 0;
  }
  let renderedLines = 0;

  return new Promise((resolve, reject) => {
    let done = false;
    let controls;
    let backPending = false;

    const finish = (value, submittedWithEnter = false) => {
      if (done) {
        return;
      }
      done = true;
      const label = choices.find((choice) => choice.value === value)?.label ?? String(value);
      renderedLines = renderBlock(
        output,
        renderedLines + (submittedWithEnter ? 1 : 0),
        doneLines(message, label),
      );
      recordDonePrompt(rl);
      controls.cleanup();
      resolve(value);
    };

    const renderChoice = (choice, index) => {
      const active = index === selected;
      const marker = active ? color.cyan(symbol.selected) : color.dim(symbol.unselected);
      const label = active ? activeLabel(choice.label) : inactiveLabel(choice.label);
      return `${activeRail()}  ${marker} ${label}${choiceHint(choice)}`;
    };

    const render = () => {
      renderedLines = renderBlock(output, renderedLines, [
        questionLine(message, backPending ? backHelp : undefined),
        ...choices.map(renderChoice),
        activeEnd(),
      ]);
    };

    const onKeypress = (str, key = {}) => {
      if (isCtrlC(key)) {
        done = true;
        controls.cancel();
        return;
      }
      if (isEscape(key)) {
        if (backPending) {
          done = true;
          clearRendered(output, renderedLines);
          controls.back();
          return;
        }
        backPending = true;
        render();
        return;
      }
      backPending = false;
      if (isUp(str, key)) {
        selected = moveIndex(selected, choices.length, -1);
        render();
        return;
      }
      if (isDown(str, key)) {
        selected = moveIndex(selected, choices.length, 1);
        render();
        return;
      }
      if (isEnter(key)) {
        finish(choices[selected].value, true);
        return;
      }
      if (isPrintable(str)) {
        render();
      }
    };

    controls = withKeypress({ rl, input, onKeypress, reject });
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

  while (true) {
    const answer = (await promptText(
      rl,
      `${message}\n${fallbackValueList(choices)}`,
      defaultValue,
      () => true,
    )).trim();
    const byValue = choices.find((choice) => choice.value === answer);
    if (byValue) {
      return byValue.value;
    }
    console.log(color.yellow('Pick one listed value.'));
  }
};

const promptMultiselectKeys = (rl, message, choices, defaultValues, { required = false } = {}) => {
  if (!canUseKeys(rl)) {
    return null;
  }

  const input = rl.input;
  const output = rl.output;
  const selectedValues = new Set(defaultValues);
  let selected = 0;
  let renderedLines = 0;

  return new Promise((resolve, reject) => {
    let done = false;
    let controls;
    let backPending = false;

    const values = () => choices
      .filter((choice) => selectedValues.has(choice.value))
      .map((choice) => choice.value);

    const renderChoice = (choice, index) => {
      const active = index === selected;
      const checked = selectedValues.has(choice.value);
      const marker = checked ? color.cyan(symbol.checked) : color.dim(symbol.unchecked);
      const label = active ? activeLabel(choice.label) : inactiveLabel(choice.label);
      return `${activeRail()}  ${marker} ${label}${choiceHint(choice)}`;
    };

    const render = (messageHint = '(↑/↓ to navigate, space to select, a to toggle all, enter to confirm)') => {
      renderedLines = renderBlock(output, renderedLines, [
        questionLine(message, backPending ? backHelp : messageHint),
        ...choices.map(renderChoice),
        activeEnd(),
      ]);
    };

    const finish = (submittedWithEnter = false) => {
      const selected = values();
      if (required && selected.length === 0) {
        if (submittedWithEnter) {
          renderedLines += 1;
        }
        render(color.yellow('(select at least one option)'));
        return;
      }
      if (done) {
        return;
      }
      done = true;
      const label = choices
        .filter((choice) => selectedValues.has(choice.value))
        .map((choice) => choice.label)
        .join(', ') || 'none';
      renderedLines = renderBlock(
        output,
        renderedLines + (submittedWithEnter ? 1 : 0),
        doneLines(message, label),
      );
      recordDonePrompt(rl);
      controls.cleanup();
      resolve(selected);
    };

    const toggleCurrent = () => {
      const value = choices[selected].value;
      if (selectedValues.has(value)) {
        selectedValues.delete(value);
      } else {
        selectedValues.add(value);
      }
    };

    const toggleAll = () => {
      if (selectedValues.size === choices.length) {
        selectedValues.clear();
        return;
      }
      for (const choice of choices) {
        selectedValues.add(choice.value);
      }
    };

    const onKeypress = (str, key = {}) => {
      if (isCtrlC(key)) {
        done = true;
        controls.cancel();
        return;
      }
      if (isEscape(key)) {
        if (backPending) {
          done = true;
          clearRendered(output, renderedLines);
          controls.back();
          return;
        }
        backPending = true;
        render();
        return;
      }
      backPending = false;
      if (isUp(str, key)) {
        selected = moveIndex(selected, choices.length, -1);
        render();
        return;
      }
      if (isDown(str, key)) {
        selected = moveIndex(selected, choices.length, 1);
        render();
        return;
      }
      if (key.name === 'space') {
        toggleCurrent();
        render();
        return;
      }
      if (str === 'a') {
        toggleAll();
        render();
        return;
      }
      if (isEnter(key)) {
        finish(true);
        return;
      }
      if (isPrintable(str)) {
        render();
      }
    };

    controls = withKeypress({ rl, input, onKeypress, reject });
    render();
  });
};

const promptMultiselect = async (rl, message, choices, defaultValues = [], options = {}) => {
  if (choices.length === 0) {
    return [];
  }

  const keyChoice = promptMultiselectKeys(rl, message, choices, defaultValues, options);
  if (keyChoice) {
    return keyChoice;
  }

  const defaultText = defaultValues.length ? defaultValues.join(',') : '';
  while (true) {
    const answer = (await promptText(
      rl,
      `${message}\n${fallbackValueList(choices)}\nEnter values separated by commas`,
      defaultText,
      () => true,
    )).trim();
    const values = answer
      ? answer.split(',').map((value) => value.trim()).filter(Boolean)
      : [];
    const valid = values.every((value) => choices.some((choice) => choice.value === value));
    if (valid && (!options.required || values.length > 0)) {
      return values;
    }
    console.log(color.yellow('Pick listed values only.'));
  }
};

module.exports = {
  promptChoice,
  promptMultiselect,
  promptText,
  promptYesNo,
};
