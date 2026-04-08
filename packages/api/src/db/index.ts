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
  user_id: string | null;
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

/** Callback for extending the database schema (e.g. adding user tables). */
export type DbMigration = (db: BetterSqlite3.Database) => void;

// ── Init ────────────────────────────────────────────────────────────────
export function initDb(dbPath: string, migrations?: DbMigration[]): BetterSqlite3.Database {
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
      duration_ms INTEGER,
      user_id TEXT
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
    CREATE INDEX IF NOT EXISTS idx_scans_user_id ON scans(user_id);
  `);

  // Migration: add user_id column to scans if missing (for existing databases)
  const hasUserId = db.prepare(
    "SELECT COUNT(*) as cnt FROM pragma_table_info('scans') WHERE name = 'user_id'"
  ).get() as { cnt: number };

  if (hasUserId.cnt === 0) {
    db.exec('ALTER TABLE scans ADD COLUMN user_id TEXT');
    db.exec('CREATE INDEX IF NOT EXISTS idx_scans_user_id ON scans(user_id)');
  }

  // Run external migrations (e.g. auth tables from pro)
  if (migrations) {
    for (const m of migrations) m(db);
  }

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

// ── CRUD: Scans ──────────────────────────────────────────────────────────
export function createScan(
  db: BetterSqlite3.Database,
  opts: { id?: string; url: string; handlerCount: number; userId?: string },
): string {
  const id = opts.id ?? randomUUID();
  db.prepare(
    'INSERT INTO scans (id, url, handler_count, status, user_id) VALUES (?, ?, ?, ?, ?)',
  ).run(id, opts.url, opts.handlerCount, 'running', opts.userId ?? null);
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
  opts: { limit?: number; offset?: number; userId?: string; all?: boolean; search?: string } = {},
): Scan[] {
  const limit = opts.limit ?? 20;
  const offset = opts.offset ?? 0;
  const search = opts.search ? `%${opts.search}%` : null;

  if (opts.userId && !opts.all) {
    if (search) {
      return db.prepare('SELECT * FROM scans WHERE user_id = ? AND url LIKE ? ORDER BY created_at DESC LIMIT ? OFFSET ?')
        .all(opts.userId, search, limit, offset) as Scan[];
    }
    return db.prepare('SELECT * FROM scans WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?')
      .all(opts.userId, limit, offset) as Scan[];
  }

  if (search) {
    return db.prepare('SELECT * FROM scans WHERE url LIKE ? ORDER BY created_at DESC LIMIT ? OFFSET ?')
      .all(search, limit, offset) as Scan[];
  }
  return db.prepare('SELECT * FROM scans ORDER BY created_at DESC LIMIT ? OFFSET ?')
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

export function getScanCount(db: BetterSqlite3.Database, search?: string): number {
  if (search) {
    const pattern = `%${search}%`;
    const row = db.prepare('SELECT COUNT(*) as cnt FROM scans WHERE url LIKE ?').get(pattern) as { cnt: number };
    return row.cnt;
  }
  const row = db.prepare('SELECT COUNT(*) as cnt FROM scans').get() as { cnt: number };
  return row.cnt;
}

/**
 * Classify an error the same way the frontend does.
 * Must stay in sync with packages/web/src/components/results/classify-error.ts
 */
function classifyError(error: string, errorCategory?: string): 'tool' | 'info' | 'site' {
  if (errorCategory === 'tool' || errorCategory === 'info' || errorCategory === 'site') {
    return errorCategory;
  }
  const lower = error.toLowerCase();
  if (
    lower.includes('api key') || lower.includes('api_key') || lower.includes('invalid url') ||
    lower.includes('typeerror') || lower.includes('econnrefused') || lower.includes('is required for') ||
    lower.includes('chromium') || lower.includes('chrome') || lower.includes('puppeteer') ||
    lower.includes('provide built') || lower.includes('provide google') ||
    lower.includes('provide cloud') || lower.includes('provide tranco')
  ) return 'tool';
  if (
    lower.includes('not found') || lower.includes('no match') || lower.includes('not serve') ||
    lower.includes('no mail server') || lower.includes('no data found') ||
    lower.includes('no txt record') || lower.includes('never been archived') ||
    lower.includes('no matches found')
  ) return 'info';
  return 'site';
}

export function getScanResultSummary(
  db: BetterSqlite3.Database,
  scanId: string,
): { ok: number; issues: number; info: number; skipped: number } {
  const rows = db.prepare(
    'SELECT result FROM scan_results WHERE scan_id = ?'
  ).all(scanId) as Array<{ result: string }>;

  let ok = 0, issues = 0, info = 0, skipped = 0;
  for (const row of rows) {
    try {
      const parsed = JSON.parse(row.result);
      if (parsed.skipped) {
        skipped++;
      } else if (parsed.error) {
        const cat = classifyError(parsed.error, parsed.errorCategory);
        if (cat === 'tool') skipped++;
        else if (cat === 'info') info++;
        else issues++;
      } else {
        ok++;
      }
    } catch { issues++; }
  }
  return { ok, issues, info, skipped };
}
