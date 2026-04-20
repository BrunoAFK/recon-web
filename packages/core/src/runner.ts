import pLimit from 'p-limit';
import { registry, getHandlerNames } from './registry.js';
import type { HandlerOptions, HandlerResult } from './types.js';
import { normalizeUrl, extractHostname } from './utils/url.js';
import { assertPublicHost } from './utils/network.js';

export interface RunOptions {
  /** Maximum number of handlers to run concurrently (default: 8). */
  concurrency?: number;
  /** Subset of handler names to run. Defaults to all registered handlers. */
  handlers?: string[];
}

/**
 * Run analysis handlers with concurrency control.
 * The `screenshot` handler runs last so the page has time to fully load.
 * Returns a map of handler name → result.
 */
export async function runHandlers(
  rawUrl: string,
  handlerOpts: HandlerOptions,
  runOpts?: RunOptions,
): Promise<Record<string, HandlerResult>> {
  const url = normalizeUrl(rawUrl);
  const concurrency = runOpts?.concurrency ?? 8;
  const allNames = runOpts?.handlers ?? getHandlerNames();
  const limit = pLimit(concurrency);

  // SSRF guard: block requests to private/internal IP addresses
  try {
    const hostname = extractHostname(url);
    await assertPublicHost(hostname);
  } catch (err) {
    const error = (err as Error).message;
    return Object.fromEntries(
      allNames.map((name) => [name, { error } as HandlerResult]),
    );
  }

  // Separate screenshot from the rest so it runs last
  const hasScreenshot = allNames.includes('screenshot');
  const names = hasScreenshot ? allNames.filter((n) => n !== 'screenshot') : allNames;

  const runHandler = async (name: string) => {
    try {
      const result = await registry[name].handler(url, handlerOpts);
      return { name, result };
    } catch (err) {
      console.error(`[runner] Handler "${name}" threw:`, err);
      return { name, result: { error: String(err) } as HandlerResult };
    }
  };

  // Run all handlers (except screenshot) concurrently
  const entries = await Promise.all(
    names.map((name) => limit(() => runHandler(name))),
  );

  // Run screenshot last so the target page has fully loaded
  if (hasScreenshot) {
    const screenshotEntry = await runHandler('screenshot');
    entries.push(screenshotEntry);
  }

  return Object.fromEntries(entries.map(({ name, result }) => [name, result]));
}
