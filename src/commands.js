'use strict';

const cp = require('node:child_process');

const { color } = require('./ui/color');

const shellQuote = (part) => {
  if (/^[A-Za-z0-9_./:=@+-]+$/.test(part)) {
    return part;
  }
  return `'${part.replace(/'/g, "'\\''")}'`;
};

const displayCommand = (command, args) => [command, ...args].map(shellQuote).join(' ');

const printCommand = (display, { dryRun = false, label = 'command' } = {}) => {
  const resolvedLabel = dryRun ? `dry-run ${label}` : label;
  console.log(color.dim(`${resolvedLabel}:`));
  console.log(`${color.green('$')} ${color.bold(display)}`);
  console.log('');
};

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

const runCommand = (command, args, cwd, dryRun, options = {}) => {
  const display = displayCommand(command, args);
  printCommand(options.display || display, { ...options, dryRun });
  if (dryRun) {
    return;
  }
  const result = cp.spawnSync(command, args, { cwd, stdio: 'inherit' });
  if (result.status !== 0) {
    throw new Error(`Command failed (${result.status}): ${display}`);
  }
};

const runCommandCaptured = (command, args, cwd, dryRun, options = {}) => {
  const display = displayCommand(command, args);
  printCommand(options.display || display, { ...options, dryRun });
  if (dryRun) {
    return { stdout: '', stderr: '', status: 0 };
  }
  const result = cp.spawnSync(command, args, { cwd, encoding: 'utf8', maxBuffer: 1024 * 1024 * 50 });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    const error = new Error(`Command failed (${result.status}): ${display}`);
    error.status = result.status;
    error.stdout = result.stdout || '';
    error.stderr = result.stderr || '';
    error.display = display;
    throw error;
  }
  return { stdout: result.stdout || '', stderr: result.stderr || '', status: result.status };
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
  printCommand,
  runCommand,
  runCommandCaptured,
};
