'use strict';

const { npmLatest, npmPackageVersionExists, npmRecentMajorVersions } = require('./detect');
const { color, isPromptBack, promptChoice, promptText } = require('./ui');
const { clearRendered, doneLines } = require('./ui/frame');

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

  const highestMajors = recent.map(({ version }) => version);
  const hintLine = highestMajors.length > 0
    ? `${color.dim('(highest majors: ')}${color.bold(highestMajors[0])}${color.dim(
        `${highestMajors.slice(1).map((version) => ` • ${version}`).join('')})`,
      )}`
    : color.yellow(`Could not check recent ${framework} versions.`);

  while (true) {
    const remembered = opts._rememberedAnswers?.frameworkVersion;
    const defaultChoice = remembered === 'latest' || remembered === highest ? remembered : remembered ? 'custom' : 'latest';
    const selected = await promptChoice(
      rl,
      'Framework version?',
      [
        { label: highest ? `${highest} (highest semver)` : 'highest semver', value: highest || 'latest' },
        { label: latest ? `${latest} (latest tag)` : 'latest tag', value: 'latest' },
        { label: 'specify version', value: 'custom' },
      ],
      defaultChoice,
    );
    if (selected !== 'custom') {
      return selected;
    }

    try {
      return await promptText(
        rl,
        `${meta.label} version`,
        remembered && remembered !== 'latest' ? remembered : highest || latest || 'latest',
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
    } catch (error) {
      if (!isPromptBack(error)) {
        throw error;
      }
      if (rl.output?.isTTY) {
        const renderedLines = doneLines('', '').length;
        clearRendered(rl.output, renderedLines);
        rl.renderedPromptLines = Math.max(0, (rl.renderedPromptLines || 0) - renderedLines);
      }
    }
  }
};

module.exports = {
  resolveFrameworkVersion,
};
