import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { httpSecurityHandler } from './http-security.js';
import * as dns from 'node:dns/promises';

vi.mock('node:dns/promises');

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => {
  server.resetHandlers();
  vi.restoreAllMocks();
});
afterAll(() => server.close());

beforeEach(() => {
  vi.mocked(dns.lookup).mockResolvedValue({ address: '93.184.216.34', family: 4 });
});

describe('httpSecurityHandler', () => {
  it('reports all security headers present when they exist', async () => {
    server.use(
      http.get('https://mock-site.test/', () => {
        return new HttpResponse('OK', {
          status: 200,
          headers: {
            'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
            'X-Frame-Options': 'DENY',
            'X-Content-Type-Options': 'nosniff',
            'X-XSS-Protection': '1; mode=block',
            'Content-Security-Policy': "default-src 'self'",
          },
        });
      }),
    );

    const result = await httpSecurityHandler('https://mock-site.test');
    expect(result).toHaveProperty('data');
    expect(result.error).toBeUndefined();

    const data = result.data!;
    expect(data.strictTransportPolicy).toBe(true);
    expect(data.xFrameOptions).toBe(true);
    expect(data.xContentTypeOptions).toBe(true);
    expect(data.xXSSProtection).toBe(true);
    expect(data.contentSecurityPolicy).toBe(true);
  });

  it('reports all security headers absent when none exist', async () => {
    server.use(
      http.get('https://mock-site.test/', () => {
        return new HttpResponse('OK', {
          status: 200,
          headers: {
            'Content-Type': 'text/html',
          },
        });
      }),
    );

    const result = await httpSecurityHandler('https://mock-site.test');
    expect(result).toHaveProperty('data');
    expect(result.error).toBeUndefined();

    const data = result.data!;
    expect(data.strictTransportPolicy).toBe(false);
    expect(data.xFrameOptions).toBe(false);
    expect(data.xContentTypeOptions).toBe(false);
    expect(data.xXSSProtection).toBe(false);
    expect(data.contentSecurityPolicy).toBe(false);
  });

  it('reports partial security headers correctly', async () => {
    server.use(
      http.get('https://mock-site.test/', () => {
        return new HttpResponse('OK', {
          status: 200,
          headers: {
            'Strict-Transport-Security': 'max-age=31536000',
            'X-Content-Type-Options': 'nosniff',
          },
        });
      }),
    );

    const result = await httpSecurityHandler('https://mock-site.test');
    expect(result).toHaveProperty('data');

    const data = result.data!;
    expect(data.strictTransportPolicy).toBe(true);
    expect(data.xFrameOptions).toBe(false);
    expect(data.xContentTypeOptions).toBe(true);
    expect(data.xXSSProtection).toBe(false);
    expect(data.contentSecurityPolicy).toBe(false);
  });

  it('returns error on network failure', async () => {
    server.use(
      http.get('https://mock-site.test/', () => {
        return HttpResponse.error();
      }),
    );

    const result = await httpSecurityHandler('https://mock-site.test');
    expect(result).toHaveProperty('error');
    expect(typeof result.error).toBe('string');
  });
});

describe('http-security handler — SSRF', () => {
  it('refuses to fetch a hostname that resolves to AWS metadata IP', async () => {
    vi.spyOn(dns, 'lookup').mockResolvedValueOnce({ address: '169.254.169.254', family: 4 });
    const result = await httpSecurityHandler('http://metadata.example.com/');
    expect(result.error).toMatch(/private address|Blocked/i);
    expect(result.data).toBeUndefined();
  });
});
