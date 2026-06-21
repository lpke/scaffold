'use strict';

const { detectGit, listGitRemotes } = require('./detect');
const { sanitizePackageName } = require('./project');
const { color, promptChoice, promptText, promptYesNo } = require('./ui');

const resolveGitAnswers = async ({ rl, opts, targetDir }) => {
  const git = detectGit(targetDir);
  const validModes = ['auto', 'skip', 'keep', 'init', 'replace'];
  let gitMode = opts.gitMode ?? 'auto';
  const remoteRequested = Boolean(opts.gitRemote || opts.gitRemoteRequested);
  const gitRequested = remoteRequested || opts.gitAdd === true;

  if (!validModes.includes(gitMode)) {
    throw new Error(`Unknown git mode: ${gitMode}`);
  }

  if (gitMode === 'auto') {
    if (gitRequested) {
      gitMode = git.inside ? 'keep' : 'init';
    } else if (!rl) {
      gitMode = git.inside ? 'keep' : 'skip';
    } else if (git.hasOwnGit) {
      gitMode = await promptChoice(
        rl,
        'Git repository?',
        [
          { label: 'keep existing repo', value: 'keep' },
          { label: 'replace with a fresh repo', value: 'replace' },
          { label: 'skip git changes', value: 'skip' },
        ],
        'skip',
      );
    } else if (git.inside) {
      gitMode = await promptChoice(
        rl,
        `Git repository? ${color.dim(`currently inside ${git.root}`)}`,
        [
          { label: 'keep parent/existing repo', value: 'keep' },
          { label: 'init nested repo here', value: 'init' },
          { label: 'skip git changes', value: 'skip' },
        ],
        'skip',
      );
    } else {
      gitMode = (await promptYesNo(rl, 'Initialize git repo?', false)) ? 'init' : 'skip';
    }
  }

  const canRemote = gitMode !== 'skip';
  let gitRemote = opts.gitRemote ?? null;
  const gitRemoteName = opts.gitRemoteName || 'origin';
  const defaultRemoteUrl = `https://github.com/lpke/${sanitizePackageName(targetDir)}`;
  if (canRemote && !gitRemote && rl) {
    const remotes = git.inside ? listGitRemotes(targetDir) : [];
    const configure = remoteRequested
      ? true
      : await promptYesNo(
          rl,
          remotes.length > 0
            ? `Configure git remote? ${color.dim(`existing: ${remotes.join(', ')}`)}`
            : 'Configure git remote?',
          false,
        );
    if (configure) {
      gitRemote = await promptText(rl, `Remote URL for ${gitRemoteName}`, defaultRemoteUrl, (value) =>
        value ? true : 'Remote URL is required.',
      );
    }
  }

  return {
    gitAdd: opts.gitAdd ?? canRemote,
    gitMode,
    gitRemote,
    gitRemoteName,
  };
};

module.exports = {
  resolveGitAnswers,
};
