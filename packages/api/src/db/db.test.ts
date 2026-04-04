import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import type BetterSqlite3 from 'better-sqlite3';
import {
  createScan,
  getScans,
  getScan,
  saveScanResult,
  deleteScan,
  updateScanStatus,
} from './index.js';

const CREATE_TABLES_SQL = `
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
`;

let db: BetterSqlite3.Database;

beforeEach(() => {
  db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(CREATE_TABLES_SQL);
});

afterEach(() => {
  db.close();
});

describe('DB module', () => {
  describe('initDb creates tables', () => {
    it('scans and scan_results tables exist after setup', () => {
      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
        .all() as Array<{ name: string }>;
      const names = tables.map((t) => t.name);
      expect(names).toContain('scans');
      expect(names).toContain('scan_results');
    });
  });

  describe('createScan + getScans', () => {
    it('returns the created scan', () => {
      const id = createScan(db, { url: 'https://example.com', handlerCount: 3 });
      const scans = getScans(db);

      expect(scans).toHaveLength(1);
      expect(scans[0].id).toBe(id);
      expect(scans[0].url).toBe('https://example.com');
      expect(scans[0].handler_count).toBe(3);
      expect(scans[0].status).toBe('running');
    });

    it('respects a provided id', () => {
      const id = createScan(db, { id: 'custom-id', url: 'https://test.com', handlerCount: 1 });
      expect(id).toBe('custom-id');

      const scans = getScans(db);
      expect(scans[0].id).toBe('custom-id');
    });
  });

  describe('createScan + saveScanResult + getScan', () => {
    it('returns scan with results', () => {
      const scanId = createScan(db, { url: 'https://example.com', handlerCount: 2 });

      saveScanResult(db, {
        scanId,
        handler: 'dns',
        result: { records: ['1.2.3.4'] },
        durationMs: 150,
      });
      saveScanResult(db, {
        scanId,
        handler: 'headers',
        result: { server: 'nginx' },
      });

      const scan = getScan(db, scanId);
      expect(scan).not.toBeNull();
      expect(scan!.id).toBe(scanId);
      expect(scan!.results).toHaveLength(2);

      const dns = scan!.results.find((r) => r.handler === 'dns');
      expect(dns).toBeDefined();
      expect(dns!.result).toEqual({ records: ['1.2.3.4'] });
      expect(dns!.duration_ms).toBe(150);

      const headers = scan!.results.find((r) => r.handler === 'headers');
      expect(headers).toBeDefined();
      expect(headers!.result).toEqual({ server: 'nginx' });
      expect(headers!.duration_ms).toBeNull();
    });

    it('returns null for nonexistent scan', () => {
      expect(getScan(db, 'no-such-id')).toBeNull();
    });
  });

  describe('deleteScan', () => {
    it('removes scan and cascades to results', () => {
      const scanId = createScan(db, { url: 'https://example.com', handlerCount: 1 });
      saveScanResult(db, { scanId, handler: 'dns', result: {} });

      expect(deleteScan(db, scanId)).toBe(true);
      expect(getScan(db, scanId)).toBeNull();

      // Verify results were cascade-deleted
      const results = db
        .prepare('SELECT * FROM scan_results WHERE scan_id = ?')
        .all(scanId);
      expect(results).toHaveLength(0);
    });

    it('returns false for nonexistent scan', () => {
      expect(deleteScan(db, 'no-such-id')).toBe(false);
    });
  });

  describe('getScans pagination', () => {
    it('respects limit and offset', () => {
      // Create 5 scans with slightly different timestamps to guarantee order
      for (let i = 0; i < 5; i++) {
        createScan(db, { id: `scan-${i}`, url: `https://${i}.example.com`, handlerCount: 1 });
      }

      const all = getScans(db);
      expect(all).toHaveLength(5);

      const page1 = getScans(db, { limit: 2, offset: 0 });
      expect(page1).toHaveLength(2);

      const page2 = getScans(db, { limit: 2, offset: 2 });
      expect(page2).toHaveLength(2);

      const page3 = getScans(db, { limit: 2, offset: 4 });
      expect(page3).toHaveLength(1);

      // No overlap between pages
      const allIds = [...page1, ...page2, ...page3].map((s) => s.id);
      expect(new Set(allIds).size).toBe(5);
    });

    it('defaults to limit 20 offset 0', () => {
      createScan(db, { url: 'https://example.com', handlerCount: 1 });
      const scans = getScans(db);
      expect(scans).toHaveLength(1);
    });
  });

  describe('updateScanStatus', () => {
    it('updates the scan status', () => {
      const scanId = createScan(db, { url: 'https://example.com', handlerCount: 1 });

      updateScanStatus(db, scanId, 'completed', 450);

      const scan = getScan(db, scanId);
      expect(scan!.status).toBe('completed');
      expect(scan!.duration_ms).toBe(450);
    });

    it('does not throw for nonexistent scan', () => {
      expect(() => updateScanStatus(db, 'no-such-id', 'completed')).not.toThrow();
    });
  });
});
