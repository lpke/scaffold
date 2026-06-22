'use strict';

const { applyDirClean, applyDirCopyAsset, applyDirCopyTemplate, applyDirEnsure } = require('./directory-actions');
const {
  applyFileCopy,
  applyFileCopyAsset,
  applyFileCopyTemplate,
  applyFileDelete,
  applyFileMove,
  applyFileWrite,
} = require('./file-actions');
const {
  applyJsonDelete,
  applyJsonMerge,
  applyJsonPatch,
  applyJsonSet,
} = require('./json-actions');
const { shouldRunAction } = require('./conditions');
const {
  applyTextAppend,
  applyTextEnsureTrailingNewline,
  applyTextInsert,
  applyTextMergeLines,
  applyTextPrepend,
  applyTextRemoveLines,
  applyTextSetProperties,
  applyTextReplace,
} = require('./text-actions');

const ACTIONS = {
  'dir.clean': applyDirClean,
  'dir.copyAsset': applyDirCopyAsset,
  'dir.copyTemplate': applyDirCopyTemplate,
  'dir.delete': applyFileDelete,
  'dir.ensure': applyDirEnsure,
  'file.copy': applyFileCopy,
  'file.copyAsset': applyFileCopyAsset,
  'file.copyTemplate': applyFileCopyTemplate,
  'file.delete': applyFileDelete,
  'file.move': applyFileMove,
  'file.write': applyFileWrite,
  'json.delete': applyJsonDelete,
  'json.merge': applyJsonMerge,
  'json.patch': applyJsonPatch,
  'json.set': applyJsonSet,
  'text.append': applyTextAppend,
  'text.ensureTrailingNewline': applyTextEnsureTrailingNewline,
  'text.insertAfter': (args) => applyTextInsert({ ...args, after: true }),
  'text.insertBefore': (args) => applyTextInsert({ ...args, after: false }),
  'text.mergeLines': applyTextMergeLines,
  'text.prepend': applyTextPrepend,
  'text.remove': (args) => applyTextReplace({
    ...args,
    action: {
      ...args.action,
      replace: '',
    },
  }),
  'text.removeLines': applyTextRemoveLines,
  'text.replace': applyTextReplace,
  'text.setProperties': applyTextSetProperties,
};

const normalizeContext = (context) => ({
  answers: {},
  values: {},
  ...context,
});

const applyAction = async ({ workspace, action, context }) => {
  if (!action || typeof action !== 'object') {
    throw new Error('Action must be an object');
  }
  if (action.type === 'group') {
    if (!(await shouldRunAction(action, context))) {
      return;
    }
    await applyActions({ workspace, actions: action.actions ?? [], context });
    return;
  }
  if (typeof action.type !== 'string') {
    throw new Error('Action needs a string type');
  }
  if (!(await shouldRunAction(action, context))) {
    return;
  }

  const handler = ACTIONS[action.type];
  if (!handler) {
    throw new Error(`Unknown action type: ${action.type}`);
  }
  await handler({ workspace, action, context });
};

const applyActions = async ({ workspace, actions, context = {} }) => {
  const resolvedContext = normalizeContext({ ...context, workspace });
  for (const action of actions ?? []) {
    await applyAction({ workspace, action, context: resolvedContext });
  }
};

module.exports = {
  ACTIONS,
  applyAction,
  applyActions,
};
