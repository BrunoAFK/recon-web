import pLimit from 'p-limit';
import ora from 'ora';
import pc from 'picocolors';
import {
  registry,
  getHandlerNames,
  normalizeUrl,
  runHandlers,
  type HandlerOptions,
  type HandlerResult,
} from '@recon-web/core';
import { readFileSync } from 'node:fs';
import {
  formatHandlerResult,
  formatHeader,
  formatSummary,
  formatSeparator,
  formatJunit,
  checkThresholds,
  diffResults,
} from './formatter.js';
import { loadConfig } from './config.js';

export type OutputFormat = 'text' | 'json' | 'junit';

interface RunOptions {
  json?: boolean;
  verbose?: boolean;
  only?: string;
  timeout?: number;
  format?: OutputFormat;
  failOn?: string[];
  diff?: string;
}

export async function runAll(rawUrl: string, options: RunOptions): Promise<void> {
  const url = normalizeUrl(rawUrl);
  const config = loadConfig();

  const handlerOpts: HandlerOptions = {
    timeout: options.timeout ?? 30000,
    apiKeys: config.apiKeys,
    chromePath: config.chromePath,
  };

  // Determine which handlers to run
  let handlerNames = getHandlerNames();
  if (options.only) {
    const selected = options.only.split(',').map((s) => s.trim());
    handlerNames = handlerNames.filter((name) => selected.includes(name));
    if (handlerNames.length === 0) {
      console.error(pc.red('No matching handlers found. Available: ' + getHandlerNames().join(', ')));
      process.exit(1);
    }
  }

  // Skip Chromium-dependent handlers if no Chrome available
  const chromiumHandlers = handlerNames.filter(
    (name) => registry[name]?.metadata.requiresChromium,
  );
  if (chromiumHandlers.length > 0 && !config.chromePath) {
    handlerNames = handlerNames.filter(
      (name) => !registry[name]?.metadata.requiresChromium,
    );
  }

  // Determine output format
  const format = options.format ?? (options.json ? 'json' : 'text');

  if (format === 'json') {
    return runJson(url, handlerNames, handlerOpts, options);
  }
  if (format === 'junit') {
    return runJunit(url, handlerNames, handlerOpts, options);
  }

  return runInteractive(url, handlerNames, handlerOpts, options.verbose ?? false, options);
}

async function runJson(
  url: string,
  handlerNames: string[],
  handlerOpts: HandlerOptions,
  options: RunOptions,
): Promise<void> {
  const results = await runHandlers(url, handlerOpts, {
    concurrency: 8,
    handlers: handlerNames,
  });

  const output: Record<string, unknown> = { url, results };

  // Diff against previous results
  if (options.diff) {
    const prev = JSON.parse(readFileSync(options.diff, 'utf-8'));
    const diffs = diffResults(prev.results ?? {}, results);
    output.diff = diffs;
  }

  console.log(JSON.stringify(output, null, 2));
  handleFailOn(options, results);
}

async function runJunit(
  url: string,
  handlerNames: string[],
  handlerOpts: HandlerOptions,
  options: RunOptions,
): Promise<void> {
  const startTime = Date.now();
  const results = await runHandlers(url, handlerOpts, {
    concurrency: 8,
    handlers: handlerNames,
  });
  const durationMs = Date.now() - startTime;

  console.log(formatJunit(url, results, durationMs));
  handleFailOn(options, results);
}

function handleFailOn(
  options: RunOptions,
  results: Record<string, HandlerResult>,
): void {
  if (!options.failOn || options.failOn.length === 0) return;

  const checks = checkThresholds(options.failOn, results);
  const failures = checks.filter((c) => !c.passed);

  if (failures.length > 0) {
    for (const f of failures) {
      console.error(pc.red(`FAIL: ${f.rule} — ${f.message}`));
    }
    process.exit(1);
  }
}

async function runInteractive(
  url: string,
  handlerNames: string[],
  handlerOpts: HandlerOptions,
  verbose: boolean,
  options: RunOptions,
): Promise<void> {
  console.log(formatHeader(url));

  const startTime = Date.now();
  let succeeded = 0;
  let failed = 0;
  let skipped = 0;

  const CONCURRENCY = 8;
  const limit = pLimit(CONCURRENCY);
  const spinner = ora({ text: pc.dim('Starting scan...'), color: 'cyan' }).start();
  let completed = 0;

  const updateSpinner = () => {
    spinner.text = pc.dim(`Running handlers... ${completed}/${handlerNames.length} done`);
  };

  const tasks = handlerNames.map((name) =>
    limit(async () => {
      const entry = registry[name]!;
      try {
        const result = await entry.handler(url, handlerOpts);
        return { name, result };
      } catch (err) {
        return { name, result: { error: String(err) } as HandlerResult };
      }
    }).then((entry) => {
      completed++;
      updateSpinner();
      return entry;
    }),
  );

  const results = await Promise.all(tasks);
  spinner.stop();

  for (const { name, result } of results) {
    const metadata = registry[name]!.metadata;

    if (result.error) {
      failed++;
    } else if (result.skipped) {
      skipped++;
    } else {
      succeeded++;
    }

    console.log(formatHandlerResult(name, metadata, result, verbose));
  }

  const durationMs = Date.now() - startTime;
  console.log(
    formatSummary(handlerNames.length, succeeded, failed, skipped, durationMs),
  );

  // Convert results array to record for threshold/diff checks
  const resultsMap: Record<string, HandlerResult> = {};
  for (const { name, result } of results) {
    resultsMap[name] = result;
  }

  // Diff against previous results
  if (options.diff) {
    const prev = JSON.parse(readFileSync(options.diff, 'utf-8'));
    const diffs = diffResults(prev.results ?? {}, resultsMap);
    if (diffs.length > 0) {
      console.log(pc.bold('\nChanges detected:'));
      for (const d of diffs) {
        const icon = d.type === 'added' ? pc.green('+') : d.type === 'removed' ? pc.red('-') : pc.yellow('~');
        console.log(`  ${icon} ${pc.bold(d.handler)}: ${d.detail}`);
      }
    } else {
      console.log(pc.dim('\nNo changes detected.'));
    }
  }

  handleFailOn(options, resultsMap);
}

export async function runSingle(
  rawUrl: string,
  handlerName: string,
  options: RunOptions,
): Promise<void> {
  const url = normalizeUrl(rawUrl);
  const config = loadConfig();

  const handlerOpts: HandlerOptions = {
    timeout: options.timeout ?? 30000,
    apiKeys: config.apiKeys,
    chromePath: config.chromePath,
  };

  const entry = registry[handlerName];
  if (!entry) {
    console.error(pc.red(`Unknown handler: ${handlerName}`));
    process.exit(1);
  }

  if (entry.metadata.requiresChromium && !config.chromePath) {
    console.error(pc.yellow(`Skipping ${handlerName}: requires Chromium (set CHROME_PATH or chromePath in .recon-web.json)`));
    process.exit(0);
  }

  if (options.json) {
    const result = await entry.handler(url, handlerOpts);
    console.log(JSON.stringify({ url, handler: handlerName, ...result }, null, 2));
    return;
  }

  const spinner = ora({ text: pc.dim(`Running ${handlerName}...`), color: 'cyan' }).start();
  const result = await entry.handler(url, handlerOpts);
  spinner.stop();

  console.log(formatHandlerResult(handlerName, entry.metadata, result, options.verbose ?? true));
}
