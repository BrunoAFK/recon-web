#!/usr/bin/env node

import { Command } from 'commander';
import { registry, getHandlerNames } from '@recon-web/core';
import { runAll, runSingle } from './runner.js';

const program = new Command();

program
  .name('recon-web')
  .description('OSINT website analysis tool — scan any website from the command line')
  .version('1.0.0');

// Main "scan" command: recon-web scan <url>
program
  .command('scan', { isDefault: true })
  .description('Run all analysis handlers against a URL')
  .argument('<url>', 'URL or domain to analyze')
  .option('-j, --json', 'Output results as JSON')
  .option('-v, --verbose', 'Show detailed output for each handler')
  .option('--only <handlers>', 'Run only specific handlers (comma-separated)')
  .option('--timeout <ms>', 'Timeout per handler in milliseconds', '30000')
  .option('-f, --format <format>', 'Output format: text, json, or junit', 'text')
  .option('--fail-on <rules...>', 'Exit with code 1 if condition met (e.g. ssl:expired, http-security:below:80)')
  .option('--diff <file>', 'Compare results against a previous JSON scan file')
  .action(async (url: string, options) => {
    try {
      await runAll(url, {
        json: options.json,
        verbose: options.verbose,
        only: options.only,
        timeout: parseInt(options.timeout, 10),
        format: options.format,
        failOn: options.failOn,
        diff: options.diff,
      });
    } catch (err) {
      console.error(`Error: ${(err as Error).message}`);
      process.exit(1);
    }
  });

// Auto-generate sub-commands from handler registry
for (const name of getHandlerNames()) {
  const entry = registry[name]!;
  const meta = entry.metadata;

  let desc = meta.description;
  if (meta.requiresApiKey?.length) {
    desc += ` (requires: ${meta.requiresApiKey.join(', ')})`;
  }
  if (meta.requiresChromium) {
    desc += ' (requires Chromium)';
  }

  program
    .command(name)
    .description(desc)
    .argument('<url>', 'URL or domain to analyze')
    .option('-j, --json', 'Output results as JSON')
    .option('-v, --verbose', 'Show detailed output')
    .option('--timeout <ms>', 'Timeout in milliseconds', '30000')
    .action(async (url: string, options) => {
      try {
        await runSingle(url, name, {
          json: options.json,
          verbose: options.verbose,
          timeout: parseInt(options.timeout, 10),
        });
      } catch (err) {
        console.error(`Error: ${(err as Error).message}`);
        process.exit(1);
      }
    });
}

program.parse();
