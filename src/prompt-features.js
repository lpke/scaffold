'use strict';

const { promptChoice, promptMultiselect } = require('./ui');

const featureSet = async (rl, opts, message, choices) => {
  const answers = {};
  const promptChoices = [];
  const defaultValues = [];

  for (const choice of choices) {
    const value = opts[choice.key];
    if (value === true || value === false) {
      answers[choice.key] = value;
      continue;
    }
    promptChoices.push({
      defaultValue: choice.defaultValue,
      label: choice.label,
      value: choice.key,
      hint: choice.hint,
    });
    if (choice.defaultValue) {
      defaultValues.push(choice.key);
    }
  }

  if (rl && promptChoices.length > 0) {
    const selected = new Set(await promptMultiselect(rl, message, promptChoices, defaultValues));
    for (const choice of promptChoices) {
      answers[choice.value] = selected.has(choice.value);
    }
  } else {
    for (const choice of promptChoices) {
      answers[choice.value] = Boolean(choice.defaultValue);
    }
  }

  return answers;
};

const typescriptChoices = [
  { label: 'none', value: 'none' },
  { label: 'non-strict', value: 'non-strict' },
  { label: 'strict', value: 'strict' },
];

const resolveTypescriptAnswers = async (rl, opts) => {
  if (opts.typescript === false) {
    return { typescript: false, tsMode: 'preserve' };
  }
  if (opts.tsMode != null) {
    return { typescript: true, tsMode: opts.tsMode };
  }
  if (opts.typescript === true && !rl) {
    return { typescript: true, tsMode: 'non-strict' };
  }

  const selected = rl
    ? await promptChoice(rl, 'TypeScript?', typescriptChoices, 'non-strict')
    : 'non-strict';

  return selected === 'none'
    ? { typescript: false, tsMode: 'preserve' }
    : { typescript: true, tsMode: selected };
};

module.exports = {
  featureSet,
  resolveTypescriptAnswers,
};
