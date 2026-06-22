'use strict';

const { npmLatest, npmPackageVersionExists, npmRecentMajorVersions } = require('./detect');
const { color, isPromptBack, promptChoice, promptText } = require('./ui');
const { clearRendered, doneLines } = require('./ui/frame');

const seedMeta = ({ config, foundation }) => config.seedCommands[foundation] ?? null;

const latestSeedVersion = ({ config, foundation }) => {
  const meta = seedMeta({ config, foundation });
  return meta ? npmLatest(meta.versionPackage) : null;
};

const recentSeedMajorVersions = ({ config, foundation }) => {
  const meta = seedMeta({ config, foundation });
  return meta ? npmRecentMajorVersions(meta.versionPackage, 4) : [];
};

const resolveSeedVersion = async ({ rl, opts, config, foundation }) => {
  const meta = seedMeta({ config, foundation });
  if (!meta) {
    throw new Error(`Unknown seeded foundation: ${foundation}`);
  }
  const latest = latestSeedVersion({ config, foundation });

  if (opts.seedVersion != null) {
    return opts.seedVersion;
  }

  if (!rl) {
    return latest || 'latest';
  }

  const recent = recentSeedMajorVersions({ config, foundation });
  const highest = recent[0]?.version ?? latest;
  const highestMajors = recent.map(({ version }) => version);
  const hintLine = highestMajors.length > 0
    ? `${color.dim('(highest majors: ')}${color.bold(highestMajors[0])}${color.dim(
        `${highestMajors.slice(1).map((version) => ` • ${version}`).join('')})`,
      )}`
    : color.yellow(`Could not check recent ${foundation} seed versions.`);

  while (true) {
    const remembered = opts._rememberedAnswers?.seedVersion;
    const defaultChoice =
      remembered === 'latest' || remembered === highest ? remembered : remembered ? 'custom' : 'latest';
    const selected = await promptChoice(
      rl,
      'Seed version?',
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
        `${meta.label} seed version`,
        remembered && remembered !== 'latest' ? remembered : highest || latest || 'latest',
        (value) => {
          if (!value) {
            return 'Seed version is required.';
          }
          return npmPackageVersionExists(meta.versionPackage, value)
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
  resolveSeedVersion,
};
