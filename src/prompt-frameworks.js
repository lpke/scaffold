'use strict';

const { npmLatest, npmPackageVersionExists, npmRecentMajorVersions } = require('./detect');
const { color, promptChoice, promptText } = require('./ui');
const { clearRendered } = require('./ui/frame');

const latestFrameworkVersion = ({ config, framework }) => {
  const meta = config.frameworks[framework];
  if (!meta) {
    return null;
  }
  return npmLatest(meta.latestPackage);
};

const recentFrameworkMajorVersions = ({ config, framework }) => {
  const meta = config.frameworks[framework];
  if (!meta) {
    return [];
  }
  return npmRecentMajorVersions(meta.latestPackage, 4);
};

const resolveFrameworkVersion = async ({ rl, opts, config, framework }) => {
  const meta = config.frameworks[framework];
  const latest = latestFrameworkVersion({ config, framework });

  if (opts.frameworkVersion != null) {
    return opts.frameworkVersion;
  }

  if (!rl) {
    return latest || 'latest';
  }

  const recent = recentFrameworkMajorVersions({ config, framework });
  const highest = recent[0]?.version ?? latest;

  const selected = await promptChoice(
    rl,
    'Framework version?',
    [
      { label: highest ? `${highest} (highest semver)` : 'highest semver', value: highest || 'latest' },
      { label: latest ? `${latest} (latest tag)` : 'latest tag', value: 'latest' },
      { label: 'specify version', value: 'custom' },
    ],
    'latest',
  );
  if (selected !== 'custom') {
    return selected;
  }
  if (rl.output?.isTTY) {
    clearRendered(rl.output, 3);
  }

  const highestMajors = recent.map(({ version }) => version);
  const hintLine = highestMajors.length > 0
    ? `${color.dim('(highest majors: ')}${color.bold(highestMajors[0])}${color.dim(
        `${highestMajors.slice(1).map((version) => ` • ${version}`).join('')})`,
      )}`
    : color.yellow(`Could not check recent ${framework} versions.`);

  return promptText(
    rl,
    `${meta.label} version`,
    highest || latest || 'latest',
    (value) => {
      if (!value) {
        return 'Framework version is required.';
      }
      return npmPackageVersionExists(meta.latestPackage, value)
        ? true
        : `${value} doesnt exist`;
    },
    { hintLine },
  );
};

module.exports = {
  resolveFrameworkVersion,
};
