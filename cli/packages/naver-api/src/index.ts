#!/usr/bin/env node

import { executeCli, renderError } from './commands.js';

try {
  await executeCli(process.argv);
} catch (error) {
  const command = process.argv.slice(2).find((value) => !value.startsWith('-')) ?? 'unknown';
  const result = renderError(error, command, process.argv.includes('--json'));
  process.stderr.write(`${result.output}\n`);
  process.exitCode = result.exitCode;
}
