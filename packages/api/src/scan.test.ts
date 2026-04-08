import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import type BetterSqlite3 from 'better-sqlite3';
import { registry } from '@recon-web/core';
import { executeScan } from './scan.js';
import { getScan, initDb } from './db/index.js';

let db: BetterSqlite3.Database | undefined;

afterEach(() => {
  delete registry['__test-ok'];
  delete registry['__test-error'];
  db?.close();
  db = undefined;
});

describe('executeScan', () => {
  it('streams handler lifecycle events and persists mixed results', async () => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    db.exec(`
      CREATE TABLE scans (
        id TEXT PRIMARY KEY,
        url TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        handler_count INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'running',
        duration_ms INTEGER,
        user_id TEXT
      );
      CREATE TABLE scan_results (
        id TEXT PRIMARY KEY,
        scan_id TEXT NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
        handler TEXT NOT NULL,
        result TEXT NOT NULL,
        duration_ms INTEGER
      );
    `);

    registry['__test-ok'] = {
      handler: async () => ({ data: { ok: true } }),
      metadata: { name: '__test-ok', description: 'test ok', category: 'meta' },
    };
    registry['__test-error'] = {
      handler: async () => ({ error: 'upstream failed' }),
      metadata: { name: '__test-error', description: 'test error', category: 'meta' },
    };

    const events: string[] = [];

    const result = await executeScan({
      db,
      url: 'https://example.com',
      handlerOptions: { timeout: 1000 },
      concurrency: 1,
      handlers: ['__test-ok', '__test-error'],
      onEvent: (event) => {
        events.push(event.type);
      },
    });

    expect(result.scanId).toBeTruthy();
    expect(result.results['__test-ok']).toEqual({ data: { ok: true } });
    expect(result.results['__test-error']).toEqual({ error: 'upstream failed' });
    expect(events).toEqual([
      'scan_started',
      'handler_started',
      'handler_finished',
      'handler_started',
      'handler_finished',
      'scan_completed',
    ]);

    const stored = getScan(db, result.scanId);
    expect(stored?.status).toBe('completed');
    expect(stored?.duration_ms).not.toBeNull();
    expect(stored?.results).toHaveLength(2);
  });

  it('adds missing duration_ms column during db initialization', () => {
    const path = `/tmp/recon-web-scan-test-${Date.now()}.db`;
    db = initDb(path);

    const columns = db.prepare("PRAGMA table_info(scans)").all() as Array<{ name: string }>;
    expect(columns.some((column) => column.name === 'duration_ms')).toBe(true);
  });
});
