'use strict';

const { color } = require('./ui/color');
const { createPrompter, intro, isPromptBack, outro } = require('./ui/frame');
const { promptChoice, promptMultiselect, promptText, promptYesNo } = require('./ui/prompts');

module.exports = {
  color,
  createPrompter,
  intro,
  isPromptBack,
  outro,
  promptChoice,
  promptMultiselect,
  promptText,
  promptYesNo,
};
