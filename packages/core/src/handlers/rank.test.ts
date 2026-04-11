import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { rankHandler } from './rank.js';
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

const TEST_URL = 'https://example.com';

describe('rankHandler', () => {
  it('returns rank data when domain is ranked', async () => {
    server.use(
      http.get('https://tranco-list.eu/api/ranks/domain/example.com', () => {
        return HttpResponse.json({
          ranks: [
            { date: '2024-01-15', rank: 512 },
            { date: '2024-01-14', rank: 519 },
          ],
          domain: 'example.com',
        });
      }),
    );

    const result = await rankHandler(TEST_URL);
    expect(result).toHaveProperty('data');
    expect(result.error).toBeUndefined();
    expect(result.skipped).toBeUndefined();

    const data = result.data!;
    expect(data.domain).toBe('example.com');
    expect(data.ranks).toHaveLength(2);
    expect(data.ranks[0].rank).toBe(512);
  });

  it('returns informational data when domain is not ranked', async () => {
    server.use(
      http.get('https://tranco-list.eu/api/ranks/domain/unknown-site.test', () => {
        return HttpResponse.json({ ranks: [], domain: 'unknown-site.test' });
      }),
    );

    const result = await rankHandler('https://unknown-site.test');
    expect(result).toHaveProperty('data');
    expect(result.data?.message).toContain('not ranked');
    expect(result.data?.ranks).toEqual([]);
  });

  it('returns informational data when API returns empty data', async () => {
    server.use(
      http.get('https://tranco-list.eu/api/ranks/domain/example.com', () => {
        return HttpResponse.json({});
      }),
    );

    const result = await rankHandler(TEST_URL);
    expect(result).toHaveProperty('data');
    expect(result.data?.ranks).toEqual([]);
  });

  it('returns error on API failure', async () => {
    server.use(
      http.get('https://tranco-list.eu/api/ranks/domain/example.com', () => {
        return HttpResponse.error();
      }),
    );

    const result = await rankHandler(TEST_URL);
    expect(result).toHaveProperty('error');
    expect(result.error).toContain('Unable to fetch rank');
  });

  it('returns error for invalid URL', async () => {
    const result = await rankHandler('');
    expect(result).toHaveProperty('error');
    expect(result.error).toBe('Invalid URL');
  });

  it('passes authentication config when API key is provided', async () => {
    vi.mocked(dns.lookup).mockResolvedValue({ address: '93.184.216.34', family: 4 });
    let receivedAuth: string | null = null;

    server.use(
      http.get('https://tranco-list.eu/api/ranks/domain/example.com', ({ request }) => {
        receivedAuth = request.headers.get('authorization');
        return HttpResponse.json({
          ranks: [{ date: '2024-01-15', rank: 100 }],
          domain: 'example.com',
        });
      }),
    );

    const result = await rankHandler(TEST_URL, {
      apiKeys: {
        TRANCO_API_KEY: 'my-api-key',
        TRANCO_USERNAME: 'my-user',
      },
    });

    expect(result).toHaveProperty('data');
    // Basic auth should have been sent
    expect(receivedAuth).toBeDefined();
    expect(receivedAuth).toContain('Basic');
  });
});

describe('rank handler — SSRF', () => {
  it('refuses to fetch a hostname that resolves to AWS metadata IP', async () => {
    vi.spyOn(dns, 'lookup').mockResolvedValueOnce({ address: '169.254.169.254', family: 4 });
    const result = await rankHandler('http://metadata.example.com/');
    expect(result.error).toMatch(/private address|Blocked/i);
    expect(result.data).toBeUndefined();
  });
});
