import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { headersHandler } from './headers.js';
import * as dns from 'node:dns/promises';

vi.mock('node:dns/promises');

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => {
  server.resetHandlers();
  vi.restoreAllMocks();
});
afterAll(() => server.close());

// Default: dns.lookup resolves to a public IP so existing MSW tests pass through safeFetch
beforeEach(() => {
  vi.mocked(dns.lookup).mockResolvedValue({ address: '93.184.216.34', family: 4 });
});

describe('headersHandler', () => {
  it('returns headers from a successful HTTP response', async () => {
    server.use(
      http.get('https://mock-site.test/', () => {
        return new HttpResponse('OK', {
          status: 200,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'X-Custom-Header': 'test-value',
            'X-Frame-Options': 'DENY',
          },
        });
      }),
    );

    const result = await headersHandler('https://mock-site.test/');
    expect(result).toHaveProperty('data');
    expect(result.error).toBeUndefined();

    const data = result.data!;
    expect(data['content-type']).toContain('text/html');
    expect(data['x-custom-header']).toBe('test-value');
    expect(data['x-frame-options']).toBe('DENY');
  });

  it('returns headers even for non-200 status codes', async () => {
    server.use(
      http.get('https://mock-site.test/', () => {
        return new HttpResponse('Not Found', {
          status: 404,
          headers: { 'X-Error': 'not-found' },
        });
      }),
    );

    const result = await headersHandler('https://mock-site.test/');
    expect(result).toHaveProperty('data');
    expect(result.data!['x-error']).toBe('not-found');
  });

  it('returns error on network failure', async () => {
    server.use(
      http.get('https://mock-site.test/', () => {
        return HttpResponse.error();
      }),
    );

    const result = await headersHandler('https://mock-site.test/');
    expect(result).toHaveProperty('error');
    expect(typeof result.error).toBe('string');
  });
});

describe('headers handler — SSRF', () => {
  it('refuses to fetch a hostname that resolves to AWS metadata IP', async () => {
    vi.spyOn(dns, 'lookup').mockResolvedValueOnce({ address: '169.254.169.254', family: 4 });
    const result = await headersHandler('http://metadata.example.com/', {});
    expect(result.error).toMatch(/private address|Blocked/i);
    expect(result.data).toBeUndefined();
  });
});
