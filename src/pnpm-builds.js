'use strict';

const PNPM_IGNORED_BUILDS = 'ERR_PNPM_IGNORED_BUILDS';
const PNPM_APPROVE_BUILDS_FILE = 'pnpm-workspace.yaml';
const PNPM_APPROVE_BUILDS_COMMAND = 'pnpm approve-builds --all';

const outputText = (result) =>
  `${result?.stdout || ''}\n${result?.stderr || ''}\n${result?.message || ''}`;

const hasPnpmIgnoredBuilds = (result) => outputText(result).includes(PNPM_IGNORED_BUILDS);

const pnpmIgnoredBuildPackages = (result) => {
  const match = outputText(result).match(/Ignored build scripts:\s*([^\n]+)/);
  if (!match) {
    return [];
  }
  return match[1]
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
};

const pnpmIgnoredBuildsLabel = (packages) =>
  packages.length > 0 ? packages.join(', ') : 'detected packages';

const logPnpmBuildsApproved = (workspace) => {
  workspace?.changed.push(`updated ${PNPM_APPROVE_BUILDS_FILE} with approved pnpm build scripts`);
};

const logPnpmBuildsNotApproved = (workspace, packages = []) => {
  workspace?.skipped.push({
    command: PNPM_APPROVE_BUILDS_COMMAND,
    level: 'error',
    textAfter: `for ${pnpmIgnoredBuildsLabel(packages)}`,
    textBefore: `build approvals not written to ${PNPM_APPROVE_BUILDS_FILE}`,
  });
};

const logPnpmBuildsNotNeeded = (workspace) => {
  workspace?.skipped.push(`${PNPM_APPROVE_BUILDS_FILE} update not needed for pnpm build scripts`);
};

module.exports = {
  PNPM_APPROVE_BUILDS_COMMAND,
  PNPM_APPROVE_BUILDS_FILE,
  hasPnpmIgnoredBuilds,
  logPnpmBuildsApproved,
  logPnpmBuildsNotApproved,
  logPnpmBuildsNotNeeded,
  pnpmIgnoredBuildPackages,
  pnpmIgnoredBuildsLabel,
};
