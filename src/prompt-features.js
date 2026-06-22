'use strict';

const { promptChoice, promptMultiselect } = require('./ui');

const featureSet = async (rl, opts, message, choices, options = {}) => {
  const answers = {};
  const promptChoices = [];
  const defaultValues = [];

  for (const choice of choices) {
    const value = opts[choice.key];
    if (value === true || value === false) {
      answers[choice.key] = value;
      continue;
    }
    const remembered = opts._rememberedAnswers?.[choice.key];
    promptChoices.push({
      defaultValue: remembered === true || remembered === false ? remembered : choice.defaultValue,
      label: choice.label,
      value: choice.key,
      hint: choice.hint,
    });
    if (remembered === true || (remembered !== false && choice.defaultValue)) {
      defaultValues.push(choice.key);
    }
  }

  if (opts.featurePrompts === false) {
    for (const choice of promptChoices) {
      answers[choice.value] = Boolean(choice.defaultValue);
    }
  } else if (rl && promptChoices.length > 0) {
    const selected = new Set(
      await promptMultiselect(rl, message, promptChoices, defaultValues, {
        validate: options.validate
          ? (selectedValues) => {
              const selectedSet = new Set(selectedValues);
              const selectedAnswers = { ...answers };
              for (const choice of promptChoices) {
                selectedAnswers[choice.value] = selectedSet.has(choice.value);
              }
              return options.validate(selectedAnswers);
            }
          : undefined,
      }),
    );
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
    return { typescript: true, tsMode: 'strict' };
  }
  const rememberedMode = opts._rememberedAnswers?.typescript === false
    ? 'none'
    : opts._rememberedAnswers?.tsMode;
  const defaultMode = typescriptChoices.some((choice) => choice.value === rememberedMode)
    ? rememberedMode
    : 'strict';

  const selected = rl
    ? await promptChoice(rl, 'TypeScript?', typescriptChoices, defaultMode)
    : 'strict';

  return selected === 'none'
    ? { typescript: false, tsMode: 'preserve' }
    : { typescript: true, tsMode: selected };
};

module.exports = {
  featureSet,
  resolveTypescriptAnswers,
};
