import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';
import type BetterSqlite3 from 'better-sqlite3';

// ── Types ───────────────────────────────────────────────────────────────
export interface Scan {
  id: string;
  url: string;
  created_at: string;
  handler_count: number;
  status: string;
  duration_ms: number | null;
}

export interface ScanWithResults extends Scan {
  results: ScanResult[];
}

export interface ScanResult {
  id: string;
  scan_id: string;
  handler: string;
  result: unknown;
  duration_ms: number | null;
}

// ── Init ────────────────────────────────────────────────────────────────
export function initDb(dbPath: string): BetterSqlite3.Database {
  mkdirSync(dirname(dbPath), { recursive: true });

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS scans (
      id TEXT PRIMARY KEY,
      url TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      handler_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'running',
      duration_ms INTEGER
    );

    CREATE TABLE IF NOT EXISTS scan_results (
      id TEXT PRIMARY KEY,
      scan_id TEXT NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
      handler TEXT NOT NULL,
      result TEXT NOT NULL,
      duration_ms INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_scans_url ON scans(url);
    CREATE INDEX IF NOT EXISTS idx_scans_created ON scans(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_scan_results_scan_id ON scan_results(scan_id);
  `);

  return db;
}

// ── Helpers ─────────────────────────────────────────────────────────────
function safeJsonParse(raw: string, fallback: unknown = null): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

// ── CRUD ────────────────────────────────────────────────────────────────
export function createScan(
  db: BetterSqlite3.Database,
  opts: { id?: string; url: string; handlerCount: number },
): string {
  const id = opts.id ?? randomUUID();
  db.prepare(
    'INSERT INTO scans (id, url, handler_count, status) VALUES (?, ?, ?, ?)',
  ).run(id, opts.url, opts.handlerCount, 'running');
  return id;
}

export function updateScanStatus(
  db: BetterSqlite3.Database,
  id: string,
  status: string,
  durationMs?: number,
): void {
  db.prepare('UPDATE scans SET status = ?, duration_ms = COALESCE(?, duration_ms) WHERE id = ?').run(
    status,
    durationMs ?? null,
    id,
  );
}

export function saveScanResult(
  db: BetterSqlite3.Database,
  opts: { scanId: string; handler: string; result: unknown; durationMs?: number },
): void {
  const id = randomUUID();
  db.prepare(
    'INSERT INTO scan_results (id, scan_id, handler, result, duration_ms) VALUES (?, ?, ?, ?, ?)',
  ).run(id, opts.scanId, opts.handler, JSON.stringify(opts.result), opts.durationMs ?? null);
}

export function getScans(
  db: BetterSqlite3.Database,
  opts: { limit?: number; offset?: number } = {},
): Scan[] {
  const limit = opts.limit ?? 20;
  const offset = opts.offset ?? 0;
  return db
    .prepare('SELECT * FROM scans ORDER BY created_at DESC LIMIT ? OFFSET ?')
    .all(limit, offset) as Scan[];
}

export function getScan(
  db: BetterSqlite3.Database,
  id: string,
): ScanWithResults | null {
  const scan = db.prepare('SELECT * FROM scans WHERE id = ?').get(id) as Scan | undefined;
  if (!scan) return null;

  const rows = db
    .prepare('SELECT * FROM scan_results WHERE scan_id = ?')
    .all(id) as Array<{ id: string; scan_id: string; handler: string; result: string; duration_ms: number | null }>;

  const results: ScanResult[] = rows.map((r) => ({
    ...r,
    result: safeJsonParse(r.result, { error: 'Corrupted result data' }),
  }));

  return { ...scan, results };
}

export function deleteScan(
  db: BetterSqlite3.Database,
  id: string,
): boolean {
  const info = db.prepare('DELETE FROM scans WHERE id = ?').run(id);
  return info.changes > 0;
}
