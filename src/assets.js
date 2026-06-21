'use strict';

const fs = require('node:fs');
const fsp = fs.promises;
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');

const findAssetRoot = () => {
  const candidates = [
    process.env.SCAFFOLD_SHARE_DIR,
    path.join(repoRoot, 'share/scaffold'),
    path.join(path.dirname(repoRoot), 'share/scaffold'),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'config/defaults.json'))) {
      return candidate;
    }
  }

  throw new Error(
    `Missing scaffold assets. Checked: ${candidates.join(', ')}. Restore share/scaffold/config/defaults.json.`,
  );
};

const assetRoot = findAssetRoot();

const assetPath = (relativePath) => path.join(assetRoot, relativePath);

const readAsset = async (relativePath) => {
  const filePath = assetPath(relativePath);
  try {
    return await fsp.readFile(filePath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Missing scaffold asset: ${filePath}`);
    }
    throw error;
  }
};

const readAssetJson = async (relativePath) => {
  const source = await readAsset(relativePath);
  try {
    return JSON.parse(source);
  } catch (error) {
    throw new Error(`Invalid JSON in ${assetPath(relativePath)}: ${error.message}`);
  }
};

const renderAsset = async (relativePath, values) => {
  let text = await readAsset(relativePath);
  for (const [key, value] of Object.entries(values)) {
    const token = `{{${key}}}`;
    if (!text.includes(token)) {
      throw new Error(`Template ${assetPath(relativePath)} is missing expected token ${token}`);
    }
    text = text.split(token).join(String(value));
  }
  const leftover = text.match(/{{[A-Z0-9_]+}}/);
  if (leftover) {
    throw new Error(`Template ${assetPath(relativePath)} has unresolved token ${leftover[0]}`);
  }
  return text;
};

module.exports = {
  assetPath,
  assetRoot,
  readAsset,
  readAssetJson,
  renderAsset,
};
