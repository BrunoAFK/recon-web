import dns from 'dns/promises';
import pLimit from 'p-limit';
import { getHandlerNames, getPresentationMetadata, normalizeUrl, extractHostname, registry } from '@recon-web/core';
import type BetterSqlite3 from 'better-sqlite3';
import type { HandlerOptions, HandlerResult } from '@recon-web/core';
import {
  createScan,
  saveScanResult,
  updateScanStatus,
} from './db/index.js';

export interface ScanProgressSnapshot {
  total: number;
  completed: number;
  active: number;
  failed: number;
}

export interface ScanEventBase {
  scanId: string;
  url: string;
  timestamp: string;
  progress: ScanProgressSnapshot;
}

export interface ScanStartedEvent extends ScanEventBase {
  type: 'scan_started';
  startedAt: string;
}

export interface HandlerStartedEvent extends ScanEventBase {
  type: 'handler_started';
  handler: string;
  displayName: string;
}

export interface HandlerFinishedEvent extends ScanEventBase {
  type: 'handler_finished';
  handler: string;
  displayName: string;
  result: HandlerResult;
  durationMs: number;
}

export interface ScanCompletedEvent extends ScanEventBase {
  type: 'scan_completed';
  results: Record<string, HandlerResult>;
  durationMs: number;
  completedAt: string;
}

export interface ScanFailedEvent extends ScanEventBase {
  type: 'scan_failed';
  error: string;
  durationMs: number;
}

export type ScanEvent =
  | ScanStartedEvent
  | HandlerStartedEvent
  | HandlerFinishedEvent
  | ScanCompletedEvent
  | ScanFailedEvent;

interface ExecuteScanOptions {
  db: BetterSqlite3.Database;
  url: string;
  handlerOptions: HandlerOptions;
  concurrency?: number;
  handlers?: string[];
  onEvent?: (event: ScanEvent) => void | Promise<void>;
  signal?: AbortSignal;
  userId?: string;
}

function buildProgress(progress: ScanProgressSnapshot): ScanProgressSnapshot {
  return { ...progress };
}

function isoNow(): string {
  return new Date().toISOString();
}

function getDisplayName(name: string): string {
  return getPresentationMetadata(name)?.displayName ?? registry[name]?.metadata.name ?? name;
}

async function emitEvent(
  onEvent: ExecuteScanOptions['onEvent'],
  event: ScanEvent,
): Promise<void> {
  try {
    await onEvent?.(event);
  } catch {
    // Streaming callbacks should not be able to break scan execution.
  }
}

/**
 * Pre-flight check: verify the target URL is reachable before running
 * the full scan. First resolves DNS (fast fail for non-existent domains),
 * then does a quick HTTP HEAD to confirm the server responds.
 */
async function checkUrlReachable(
  url: string,
  signal?: AbortSignal,
): Promise<void> {
  const normalized = normalizeUrl(url);
  const hostname = extractHostname(normalized);

  // Step 1: DNS resolution (fails fast for non-existent domains, ~1-3s)
  try {
    await dns.lookup(hostname);
  } catch {
    throw new Error(
      `Domain "${hostname}" does not exist or cannot be resolved. Check the URL and try again.`,
    );
  }

  if (signal?.aborted) throw new Error('Scan aborted');

  // Step 2: Quick HTTP check (server responds, ~5s timeout)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5_000);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort, { once: true });

  try {
    const response = await fetch(normalized, {
      method: 'HEAD',
      redirect: 'follow',
      signal: controller.signal,
    });
    void response;
  } catch (err) {
    if (signal?.aborted) throw new Error('Scan aborted');
    // HEAD might be blocked, try GET
    try {
      const getResponse = await fetch(normalized, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
        headers: { Range: 'bytes=0-0' },
      });
      void getResponse;
    } catch {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(
        `Domain "${hostname}" resolved but the server is not responding: ${message}`,
      );
    }
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener('abort', onAbort);
  }
}

export async function executeScan({
  db,
  url: rawUrl,
  handlerOptions,
  concurrency = 8,
  handlers,
  onEvent,
  signal,
  userId,
}: ExecuteScanOptions): Promise<{ scanId: string; results: Record<string, HandlerResult>; durationMs: number }> {
  const url = normalizeUrl(rawUrl);

  // Pre-flight reachability check (skip when running a targeted subset of handlers)
  if (!handlers) {
    await checkUrlReachable(url, signal);
  }

  const allNames = handlers ?? getHandlerNames();
  const hasScreenshot = allNames.includes('screenshot');
  const orderedHandlers = hasScreenshot
    ? allNames.filter((name: string) => name !== 'screenshot').concat('screenshot')
    : [...allNames];

  const scanId = createScan(db, { url, handlerCount: orderedHandlers.length, userId });
  const startedAt = Date.now();
  const progress: ScanProgressSnapshot = {
    total: orderedHandlers.length,
    completed: 0,
    active: 0,
    failed: 0,
  };
  const results: Record<string, HandlerResult> = {};

  await emitEvent(onEvent, {
    type: 'scan_started',
    scanId,
    url,
    timestamp: isoNow(),
    startedAt: new Date(startedAt).toISOString(),
    progress: buildProgress(progress),
  });

  const limit = pLimit(concurrency);

  const runOne = async (name: string): Promise<void> => {
    if (signal?.aborted) return;
    const displayName = getDisplayName(name);
    progress.active += 1;
    const startSnap = buildProgress(progress);
    await emitEvent(onEvent, {
      type: 'handler_started',
      scanId,
      url,
      timestamp: isoNow(),
      handler: name,
      displayName,
      progress: startSnap,
    });

    const handlerStartedAt = Date.now();
    let result: HandlerResult;

    try {
      result = await registry[name].handler(url, handlerOptions);
    } catch (error) {
      console.warn(`[scan] Handler "${name}" threw for ${url}:`, error);
      result = { error: String(error) };
    }

    const durationMs = Date.now() - handlerStartedAt;
    saveScanResult(db, { scanId, handler: name, result, durationMs });
    results[name] = result;

    progress.active -= 1;
    progress.completed += 1;
    if (result.error) {
      progress.failed += 1;
    }
    const finishSnap = buildProgress(progress);

    await emitEvent(onEvent, {
      type: 'handler_finished',
      scanId,
      url,
      timestamp: isoNow(),
      handler: name,
      displayName,
      result,
      durationMs,
      progress: finishSnap,
    });
  };

  try {
    await Promise.all(orderedHandlers.map((name: string) => limit(() => runOne(name))));

    const durationMs = Date.now() - startedAt;
    updateScanStatus(db, scanId, 'completed', durationMs);
    await emitEvent(onEvent, {
      type: 'scan_completed',
      scanId,
      url,
      timestamp: isoNow(),
      progress: buildProgress(progress),
      results,
      durationMs,
      completedAt: isoNow(),
    });

    return { scanId, results, durationMs };
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    updateScanStatus(db, scanId, 'failed', durationMs);
    await emitEvent(onEvent, {
      type: 'scan_failed',
      scanId,
      url,
      timestamp: isoNow(),
      progress: buildProgress(progress),
      error: String(error),
      durationMs,
    });
    throw error;
  }
}

// ── Global concurrent scan limiter ───────────────────────────────────
import { config } from './config.js';

type ScanResult = { scanId: string; results: Record<string, HandlerResult>; durationMs: number };

const globalScanLimit = pLimit(
  parseInt(process.env.MAX_CONCURRENT_SCANS || '', 10) || config.maxConcurrentScans || 3,
);

/** Number of scans currently running or queued. */
export function getScanQueueStatus(): { active: number; pending: number; limit: number } {
  return {
    active: globalScanLimit.activeCount,
    pending: globalScanLimit.pendingCount,
    limit: parseInt(process.env.MAX_CONCURRENT_SCANS || '', 10) || config.maxConcurrentScans || 3,
  };
}

// ── In-flight scan deduplication ─────────────────────────────────────
const inFlightScans = new Map<string, Promise<ScanResult>>();

/**
 * Wraps executeScan with in-flight deduplication and global concurrency limit.
 * - If a scan for the same URL is already running, reuses its Promise.
 * - Otherwise, queues the scan through the global limiter so at most
 *   MAX_CONCURRENT_SCANS scans run simultaneously.
 */
export async function executeScanDeduped(
  opts: ExecuteScanOptions,
): Promise<ScanResult> {
  const key = opts.url.toLowerCase().trim();
  const existing = inFlightScans.get(key);
  if (existing) return existing;

  const promise = globalScanLimit(() => executeScan(opts)).finally(() => inFlightScans.delete(key));
  inFlightScans.set(key, promise);
  return promise;
}
