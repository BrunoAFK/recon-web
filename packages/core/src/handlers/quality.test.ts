import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { qualityHandler } from './quality.js';
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

const options = {
  apiKeys: {
    GOOGLE_CLOUD_API_KEY: 'fake-google-key',
  },
};

describe('qualityHandler', () => {
  it('returns PageSpeed scores on success', async () => {
    server.use(
      http.get('https://www.googleapis.com/pagespeedonline/v5/runPagespeed', () => {
        return HttpResponse.json({
          lighthouseResult: {
            categories: {
              performance: { score: 0.92 },
              accessibility: { score: 0.85 },
              'best-practices': { score: 0.95 },
              seo: { score: 0.90 },
              pwa: { score: 0.40 },
            },
          },
        });
      }),
    );

    const result = await qualityHandler(TEST_URL, options);
    expect(result).toHaveProperty('data');
    expect(result.error).toBeUndefined();

    const data = result.data!;
    expect(data.lighthouseResult).toBeDefined();
    expect((data as any).lighthouseResult.categories.performance.score).toBe(0.92);
  });

  it('returns skipped when API key is missing', async () => {
    const result = await qualityHandler(TEST_URL, {});
    expect(result).toHaveProperty('skipped');
    expect(result.skipped).toContain('unavailable');
    expect(result.data).toBeUndefined();
  });

  it('returns skipped when API key is missing and no options provided', async () => {
    const result = await qualityHandler(TEST_URL);
    expect(result).toHaveProperty('skipped');
    expect(result.skipped).toContain('GOOGLE_CLOUD_API_KEY');
  });

  it('returns error on API failure', async () => {
    server.use(
      http.get('https://www.googleapis.com/pagespeedonline/v5/runPagespeed', () => {
        return HttpResponse.error();
      }),
    );

    const result = await qualityHandler(TEST_URL, options);
    expect(result).toHaveProperty('error');
    expect(typeof result.error).toBe('string');
    expect(result.data).toBeUndefined();
  });

  it('returns error on non-200 API response', async () => {
    server.use(
      http.get('https://www.googleapis.com/pagespeedonline/v5/runPagespeed', () => {
        return HttpResponse.json(
          { error: { code: 400, message: 'Invalid URL' } },
          { status: 400 },
        );
      }),
    );

    const result = await qualityHandler(TEST_URL, options);
    expect(result).toHaveProperty('error');
    expect(typeof result.error).toBe('string');
  });
});

describe('quality handler — SSRF', () => {
  it('refuses to fetch when the API endpoint resolves to a private address', async () => {
    // Mock all dns.lookup calls to return a private IP (affects Google API endpoint lookup)
    vi.spyOn(dns, 'lookup').mockResolvedValue({ address: '169.254.169.254', family: 4 });
    const result = await qualityHandler('https://example.com/', options);
    expect(result.error).toMatch(/private address|Blocked/i);
    expect(result.data).toBeUndefined();
  });
});
