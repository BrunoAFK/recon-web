import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { unlinkSync } from 'node:fs';
import { buildServer } from './server.js';
import type { FastifyInstance } from 'fastify';

let server: FastifyInstance;
const testDbPath = `/tmp/recon-web-server-test-${randomUUID()}.db`;

beforeAll(async () => {
  process.env.DB_PATH = testDbPath;
  server = await buildServer();
  await server.ready();
});

afterAll(async () => {
  await server.close();
  try { unlinkSync(testDbPath); } catch {}
  try { unlinkSync(testDbPath + '-wal'); } catch {}
  try { unlinkSync(testDbPath + '-shm'); } catch {}
  delete process.env.DB_PATH;
});

describe('server — CORS hardening', () => {
  let app: Awaited<ReturnType<typeof buildServer>>;
  let corsTestDbPath: string;

  beforeEach(async () => {
    delete process.env.API_CORS_ORIGIN;
    corsTestDbPath = `/tmp/recon-web-cors-test-${randomUUID()}.db`;
    process.env.DB_PATH = corsTestDbPath;
    app = await buildServer();
  });

  afterEach(async () => {
    await app.close();
    try { unlinkSync(corsTestDbPath); } catch {}
    try { unlinkSync(corsTestDbPath + '-wal'); } catch {}
    try { unlinkSync(corsTestDbPath + '-shm'); } catch {}
    delete process.env.DB_PATH;
  });

  it('does not return Access-Control-Allow-Origin: * by default', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { origin: 'http://evil.example.com' },
    });
    expect(res.headers['access-control-allow-origin']).not.toBe('*');
  });
});

describe('server — rate limiting', () => {
  let app: Awaited<ReturnType<typeof buildServer>>;
  let rateLimitTestDbPath: string;

  beforeEach(async () => {
    process.env.RATE_LIMIT_MAX = '5';
    process.env.RATE_LIMIT_WINDOW = '1 minute';
    rateLimitTestDbPath = `/tmp/recon-web-ratelimit-test-${randomUUID()}.db`;
    process.env.DB_PATH = rateLimitTestDbPath;
    app = await buildServer();
  });

  afterEach(async () => {
    await app.close();
    try { unlinkSync(rateLimitTestDbPath); } catch {}
    try { unlinkSync(rateLimitTestDbPath + '-wal'); } catch {}
    try { unlinkSync(rateLimitTestDbPath + '-shm'); } catch {}
    delete process.env.RATE_LIMIT_MAX;
    delete process.env.RATE_LIMIT_WINDOW;
    delete process.env.DB_PATH;
  });

  it('returns 429 after burst exceeds the limit', async () => {
    const responses = [];
    for (let i = 0; i < 8; i++) {
      responses.push(await app.inject({ method: 'GET', url: '/health' }));
    }
    const status = responses.map((r) => r.statusCode);
    expect(status.filter((s) => s === 429).length).toBeGreaterThan(0);
  });
});

describe('API', () => {
  describe('GET /health', () => {
    it('returns 200 with status ok, handlers count, and uptime', async () => {
      const res = await server.inject({ method: 'GET', url: '/health' });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.status).toBe('ok');
      expect(typeof body.handlers).toBe('number');
      expect(body.handlers).toBeGreaterThan(0);
      expect(typeof body.uptime).toBe('number');
    });
  });

  describe('GET /api/handlers', () => {
    it('returns 200 with an array of handler metadata', async () => {
      const res = await server.inject({ method: 'GET', url: '/api/handlers' });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThan(0);
    });

    it('each handler has name, description, and category fields', async () => {
      const res = await server.inject({ method: 'GET', url: '/api/handlers' });
      const body = JSON.parse(res.payload);
      for (const handler of body) {
        expect(handler).toHaveProperty('name');
        expect(handler).toHaveProperty('description');
        expect(handler).toHaveProperty('category');
        expect(typeof handler.name).toBe('string');
        expect(typeof handler.description).toBe('string');
        expect(typeof handler.category).toBe('string');
      }
    });
  });

  describe('GET /api/dns', () => {
    it('returns 200 with data for a valid domain', async () => {
      const res = await server.inject({ method: 'GET', url: '/api/dns?url=example.com' });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body).toBeDefined();
      expect(typeof body).toBe('object');
    });

    it('returns 400 without url param', async () => {
      const res = await server.inject({ method: 'GET', url: '/api/dns' });
      expect(res.statusCode).toBe(400);
    });

    it('returns 400 with empty url param', async () => {
      const res = await server.inject({ method: 'GET', url: '/api/dns?url=' });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('GET /api/get-ip', () => {
    it('returns 200 with a handler result shape', async () => {
      const res = await server.inject({ method: 'GET', url: '/api/get-ip?url=example.com' });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect('data' in body || 'error' in body).toBe(true);
      if ('data' in body) {
        expect(body.data).toHaveProperty('ip');
        expect(body.data).toHaveProperty('family');
      }
    });
  });

  describe('GET /api/nonexistent', () => {
    it('returns 404 for unknown handler', async () => {
      const res = await server.inject({ method: 'GET', url: '/api/nonexistent?url=example.com' });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('Handler response shape', () => {
    it('handler response has either data or error field', async () => {
      const res = await server.inject({ method: 'GET', url: '/api/dns?url=example.com' });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      const hasData = 'data' in body;
      const hasError = 'error' in body;
      expect(hasData || hasError).toBe(true);
    });
  });
});
