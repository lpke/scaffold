'use strict';

const { foundationLabel } = require('./foundations');

const projectTechLines = (answers, config) => {
  const tech = [];
  if (answers.nix) tech.push('- Nix flake dev shell');
  if (answers.direnv) tech.push('- direnv loads the flake shell');
  if (answers.nodeProject) tech.push(`- Node ${answers.nodeMajor} with ${answers.toolchainManager}`);
  if (answers.nodeProject) tech.push(`- ${foundationLabel(answers.foundation, config)} foundation`);
  if (answers.vite) tech.push(`- Vite${answers.react ? ' + React' : answers.vue ? ' + Vue' : ''}`);
  if (answers.typescript) tech.push('- TypeScript');
  if (answers.vitest) tech.push('- Vitest');
  if (answers.prettier) tech.push('- Prettier');
  if (answers.tailwind) tech.push('- Tailwind');
  return tech.length ? tech.join('\n') : '- No runtime stack selected';
};

module.exports = {
  projectTechLines,
};
