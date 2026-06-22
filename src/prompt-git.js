'use strict';

const { detectGit, listGitRemotes } = require('./detect');
const { sanitizePackageName } = require('./project');
const { color, promptChoice, promptText, promptYesNo } = require('./ui');

const remembered = (opts, key) => opts._rememberedAnswers?.[key];

const resolveGitMode = async ({ rl, opts, targetDir, mode }) => {
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
      gitMode = git.inside ? 'keep' : mode === 'fresh' ? 'init' : 'skip';
    } else if (git.hasOwnGit) {
      const defaultMode = ['keep', 'replace', 'skip'].includes(remembered(opts, 'gitMode'))
        ? remembered(opts, 'gitMode')
        : 'skip';
      gitMode = await promptChoice(
        rl,
        'Git repository?',
        [
          { label: 'keep existing repo', value: 'keep' },
          { label: 'replace with a fresh repo', value: 'replace' },
          { label: 'skip git changes', value: 'skip' },
        ],
        defaultMode,
      );
    } else if (git.inside) {
      const defaultMode = ['keep', 'init', 'skip'].includes(remembered(opts, 'gitMode'))
        ? remembered(opts, 'gitMode')
        : 'skip';
      gitMode = await promptChoice(
        rl,
        `Git repository? ${color.dim(`currently inside ${git.root}`)}`,
        [
          { label: 'keep parent/existing repo', value: 'keep' },
          { label: 'init nested repo here', value: 'init' },
          { label: 'skip git changes', value: 'skip' },
        ],
        defaultMode,
      );
    } else {
      const defaultInit = remembered(opts, 'gitMode') ? remembered(opts, 'gitMode') === 'init' : true;
      gitMode = (await promptYesNo(rl, 'Initialize git repo?', defaultInit)) ? 'init' : 'skip';
    }
  }

  return { gitMode };
};

const resolveGitRemoteConfigure = async ({ rl, opts, targetDir, gitMode }) => {
  const canRemote = gitMode !== 'skip';
  const gitRemoteName = opts.gitRemoteName || 'origin';
  const remoteRequested = Boolean(opts.gitRemote || opts.gitRemoteRequested);
  if (!canRemote || opts.gitRemote || !rl) {
    return {
      gitConfigureRemote: canRemote && Boolean(opts.gitRemote),
      gitRemoteName,
    };
  }

  const git = detectGit(targetDir);
  const remotes = git.inside ? listGitRemotes(targetDir) : [];
  const gitConfigureRemote = remoteRequested
    ? true
    : await promptYesNo(
        rl,
        remotes.length > 0
          ? `Configure git remote? ${color.dim(`existing: ${remotes.join(', ')}`)}`
          : 'Configure git remote?',
        remembered(opts, 'gitConfigureRemote') ?? false,
      );

  return { gitConfigureRemote, gitRemoteName };
};

const resolveGitRemote = async ({ rl, opts, targetDir, gitMode, gitConfigureRemote, gitRemoteName }) => {
  const canRemote = gitMode !== 'skip';
  let gitRemote = opts.gitRemote ?? null;
  if (canRemote && !gitRemote && gitConfigureRemote && rl) {
    const defaultRemoteUrl = remembered(opts, 'gitRemote') || `https://github.com/lpke/${sanitizePackageName(targetDir)}`;
    gitRemote = await promptText(rl, `Remote URL for ${gitRemoteName}`, defaultRemoteUrl, (value) =>
      value ? true : 'Remote URL is required.',
    );
  }

  return { gitRemote };
};

const resolveGitAdd = ({ opts, gitMode }) => ({
  gitAdd: opts.gitAdd ?? gitMode !== 'skip',
  gitRemoteName: opts.gitRemoteName || 'origin',
});

const resolveGitAnswers = async ({ rl, opts, targetDir, mode }) => {
  const { gitMode } = await resolveGitMode({ rl, opts, targetDir, mode });
  const { gitConfigureRemote, gitRemoteName } = await resolveGitRemoteConfigure({
    rl,
    opts,
    targetDir,
    gitMode,
  });
  const { gitRemote } = await resolveGitRemote({
    rl,
    opts,
    targetDir,
    gitMode,
    gitConfigureRemote,
    gitRemoteName,
  });
  return {
    ...resolveGitAdd({ opts, gitMode }),
    gitMode,
    gitRemote,
    gitRemoteName,
  };
};

module.exports = {
  resolveGitAdd,
  resolveGitAnswers,
  resolveGitMode,
  resolveGitRemote,
  resolveGitRemoteConfigure,
};
