import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { unlinkSync } from 'node:fs';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../server.js';

let app: FastifyInstance;
let savedEnv: Record<string, string | undefined>;
let testDbPath: string;

const AUTH_VARS = ['AUTH_ENABLED', 'AUTH_TOKEN', 'DB_PATH'];

beforeEach(() => {
  // Save current env
  savedEnv = {};
  for (const key of AUTH_VARS) {
    savedEnv[key] = process.env[key];
  }
  // Use unique DB per test to avoid SQLITE_BUSY
  testDbPath = `/tmp/recon-web-auth-test-${randomUUID()}.db`;
  process.env.DB_PATH = testDbPath;
});

afterEach(async () => {
  if (app) {
    await app.close();
  }
  // Clean up test DB
  try { unlinkSync(testDbPath); } catch {}
  try { unlinkSync(testDbPath + '-wal'); } catch {}
  try { unlinkSync(testDbPath + '-shm'); } catch {}
  // Restore env
  for (const key of AUTH_VARS) {
    if (savedEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = savedEnv[key];
    }
  }
});

describe('Auth plugin', () => {
  describe('auth disabled (default)', () => {
    it('requests pass through without auth header', async () => {
      delete process.env.AUTH_ENABLED;
      delete process.env.AUTH_TOKEN;
      app = await buildServer();
      await app.ready();

      const res = await app.inject({ method: 'GET', url: '/health' });
      expect(res.statusCode).toBe(200);
    });

    it('non-public routes also pass through when auth is disabled', async () => {
      delete process.env.AUTH_ENABLED;
      delete process.env.AUTH_TOKEN;
      app = await buildServer();
      await app.ready();

      const res = await app.inject({ method: 'GET', url: '/api/handlers' });
      expect(res.statusCode).toBe(200);
    });
  });

  describe('auth enabled', () => {
    const TEST_TOKEN = 'test-secret-token-12345';

    it('request without token gets 401', async () => {
      process.env.AUTH_ENABLED = 'true';
      process.env.AUTH_TOKEN = TEST_TOKEN;
      app = await buildServer();
      await app.ready();

      const res = await app.inject({ method: 'GET', url: '/api/dns?url=example.com' });
      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.payload);
      expect(body.error).toMatch(/[Mm]issing/);
    });

    it('request with wrong token gets 401', async () => {
      process.env.AUTH_ENABLED = 'true';
      process.env.AUTH_TOKEN = TEST_TOKEN;
      app = await buildServer();
      await app.ready();

      const res = await app.inject({
        method: 'GET',
        url: '/api/dns?url=example.com',
        headers: { authorization: 'Bearer wrong-token' },
      });
      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.payload);
      expect(body.error).toMatch(/[Ii]nvalid/);
    });

    it('request with correct token passes', async () => {
      process.env.AUTH_ENABLED = 'true';
      process.env.AUTH_TOKEN = TEST_TOKEN;
      app = await buildServer();
      await app.ready();

      const res = await app.inject({
        method: 'GET',
        url: '/api/handlers',
        headers: { authorization: `Bearer ${TEST_TOKEN}` },
      });
      expect(res.statusCode).toBe(200);
    });

    it('request with malformed auth header (no Bearer prefix) gets 401', async () => {
      process.env.AUTH_ENABLED = 'true';
      process.env.AUTH_TOKEN = TEST_TOKEN;
      app = await buildServer();
      await app.ready();

      const res = await app.inject({
        method: 'GET',
        url: '/api/dns?url=example.com',
        headers: { authorization: TEST_TOKEN },
      });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('public routes with auth enabled', () => {
    const TEST_TOKEN = 'test-secret-token-12345';

    it('/health passes through without token', async () => {
      process.env.AUTH_ENABLED = 'true';
      process.env.AUTH_TOKEN = TEST_TOKEN;
      app = await buildServer();
      await app.ready();

      const res = await app.inject({ method: 'GET', url: '/health' });
      expect(res.statusCode).toBe(200);
    });

    it('/api/handlers passes through without token', async () => {
      process.env.AUTH_ENABLED = 'true';
      process.env.AUTH_TOKEN = TEST_TOKEN;
      app = await buildServer();
      await app.ready();

      const res = await app.inject({ method: 'GET', url: '/api/handlers' });
      expect(res.statusCode).toBe(200);
    });

    it('frontend shell routes pass through without token', async () => {
      process.env.AUTH_ENABLED = 'true';
      process.env.AUTH_TOKEN = TEST_TOKEN;
      app = await buildServer();
      await app.ready();

      const res = await app.inject({ method: 'GET', url: '/' });
      expect(res.statusCode).not.toBe(401);
    });

    it('/docs passes through without token', async () => {
      process.env.AUTH_ENABLED = 'true';
      process.env.AUTH_TOKEN = TEST_TOKEN;
      app = await buildServer();
      await app.ready();

      const res = await app.inject({ method: 'GET', url: '/docs' });
      expect(res.statusCode).not.toBe(401);
    });
  });
});
