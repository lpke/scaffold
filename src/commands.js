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

const stripAnsi = (value) => String(value).replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, '');

const printCommand = (display, { dryRun = false, label = 'command' } = {}) => {
  const resolvedLabel = dryRun ? `dry-run ${label}` : label;
  if (resolvedLabel !== 'command') {
    console.log(`${color.dim('│')} ${color.dim(`${resolvedLabel}:`)}`);
  }
  console.log(`${color.dim('│')} ${color.green('$')} ${color.bold(display)}`);
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

const writeCommandOutput = (stream, state, chunk) => {
  state.raw += chunk;
  const text = stripAnsi(chunk).replace(/\r/g, '\n');
  for (const part of text.split(/(\n)/)) {
    if (!part) {
      continue;
    }
    if (state.lineStart) {
      stream.write(`${color.dim('│')} `);
      state.lineStart = false;
    }
    stream.write(color.dim(part));
    if (part === '\n') {
      state.lineStart = true;
    }
  }
};

const flushCommandOutput = (stream, state) => {
  if (!state.lineStart) {
    stream.write('\n');
    state.lineStart = true;
  }
};

const runCommandProcess = (command, args, cwd) =>
  new Promise((resolve, reject) => {
    const stdout = { raw: '', lineStart: true };
    const stderr = { raw: '', lineStart: true };
    const child = cp.spawn(command, args, { cwd, stdio: ['inherit', 'pipe', 'pipe'] });

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => writeCommandOutput(process.stdout, stdout, chunk));
    child.stderr.on('data', (chunk) => writeCommandOutput(process.stderr, stderr, chunk));
    child.on('error', reject);
    child.on('close', (status) => {
      flushCommandOutput(process.stdout, stdout);
      flushCommandOutput(process.stderr, stderr);
      resolve({ stdout: stdout.raw, stderr: stderr.raw, status });
    });
  });

const runCommand = async (command, args, cwd, dryRun, options = {}) => {
  const display = displayCommand(command, args);
  printCommand(options.display || display, { ...options, dryRun });
  if (dryRun) {
    return;
  }
  const result = await runCommandProcess(command, args, cwd);
  if (result.status !== 0) {
    throw new Error(`Command failed (${result.status}): ${display}`);
  }
};

const runCommandCaptured = async (command, args, cwd, dryRun, options = {}) => {
  const display = displayCommand(command, args);
  printCommand(options.display || display, { ...options, dryRun });
  if (dryRun) {
    return { stdout: '', stderr: '', status: 0 };
  }
  const result = await runCommandProcess(command, args, cwd);
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
