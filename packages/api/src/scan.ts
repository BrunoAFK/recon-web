import pLimit from 'p-limit';
import { getHandlerNames, getPresentationMetadata, registry } from '@recon-web/core';
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

export async function executeScan({
  db,
  url,
  handlerOptions,
  concurrency = 8,
  handlers,
  onEvent,
  signal,
}: ExecuteScanOptions): Promise<{ scanId: string; results: Record<string, HandlerResult>; durationMs: number }> {
  const allNames = handlers ?? getHandlerNames();
  const hasScreenshot = allNames.includes('screenshot');
  const orderedHandlers = hasScreenshot
    ? allNames.filter((name) => name !== 'screenshot').concat('screenshot')
    : [...allNames];

  const scanId = createScan(db, { url, handlerCount: orderedHandlers.length });
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
    await Promise.all(orderedHandlers.map((name) => limit(() => runOne(name))));

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

// ── In-flight scan deduplication ─────────────────────────────────────
type ScanResult = { scanId: string; results: Record<string, HandlerResult>; durationMs: number };
const inFlightScans = new Map<string, Promise<ScanResult>>();

/**
 * Wraps executeScan with in-flight deduplication.
 * If a scan for the same URL is already running, reuses its Promise
 * instead of starting a duplicate scan.
 */
export async function executeScanDeduped(
  opts: ExecuteScanOptions,
): Promise<ScanResult> {
  const key = opts.url.toLowerCase().trim();
  const existing = inFlightScans.get(key);
  if (existing) return existing;

  const promise = executeScan(opts).finally(() => inFlightScans.delete(key));
  inFlightScans.set(key, promise);
  return promise;
}
