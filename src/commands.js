'use strict';

const cp = require('node:child_process');

const shellQuote = (part) => {
  if (/^[A-Za-z0-9_./:=@+-]+$/.test(part)) {
    return part;
  }
  return `'${part.replace(/'/g, "'\\''")}'`;
};

const displayCommand = (command, args) => [command, ...args].map(shellQuote).join(' ');

const commandExists = (command) => {
  const result = cp.spawnSync('sh', ['-c', `command -v ${shellQuote(command)}`], {
    stdio: 'ignore',
  });
  return result.status === 0;
};

const commandVersion = (command, fallback) => {
  const result = cp.spawnSync(command, ['--version'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  const version = result.status === 0 ? result.stdout.trim().split(/\s+/)[0] : '';
  return version || fallback;
};

const runCommand = (command, args, cwd, dryRun) => {
  const display = displayCommand(command, args);
  if (dryRun) {
    console.log(`dry-run command: ${display}`);
    return;
  }
  const result = cp.spawnSync(command, args, { cwd, stdio: 'inherit' });
  if (result.status !== 0) {
    throw new Error(`Command failed (${result.status}): ${display}`);
  }
};

const commandOutput = (command, args, cwd) => {
  const result = cp.spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0) {
    return null;
  }
  return result.stdout.trim();
};

module.exports = {
  commandExists,
  commandOutput,
  commandVersion,
  displayCommand,
  runCommand,
};
