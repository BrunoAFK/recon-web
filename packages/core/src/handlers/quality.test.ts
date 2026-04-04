import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { qualityHandler } from './quality.js';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

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
