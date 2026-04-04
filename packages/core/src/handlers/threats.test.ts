import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { threatsHandler } from './threats.js';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const TEST_URL = 'https://example.com';

const options = {
  apiKeys: {
    GOOGLE_CLOUD_API_KEY: 'fake-google-key',
    CLOUDMERSIVE_API_KEY: 'fake-cloudmersive-key',
  },
};

function mockAllClean() {
  server.use(
    // URLHaus
    http.post('https://urlhaus-api.abuse.ch/v1/host/', () => {
      return HttpResponse.json({ query_status: 'no_results', urls: [] });
    }),
    // PhishTank - returns XML
    http.post('https://checkurl.phishtank.com/checkurl/', () => {
      return new HttpResponse(
        `<?xml version="1.0" encoding="utf-8"?>
        <response>
          <results>
            <in_database>false</in_database>
          </results>
        </response>`,
        { headers: { 'Content-Type': 'application/xml' } },
      );
    }),
    // Cloudmersive
    http.post('https://api.cloudmersive.com/virus/scan/website', () => {
      return HttpResponse.json({ CleanResult: true, WebsiteThreatType: 'None' });
    }),
    // Google Safe Browsing
    http.post('https://safebrowsing.googleapis.com/v4/threatMatches:find', () => {
      return HttpResponse.json({});
    }),
  );
}

describe('threatsHandler', () => {
  it('returns all clean results when no threats are found', async () => {
    mockAllClean();

    const result = await threatsHandler(TEST_URL, options);
    expect(result).toHaveProperty('data');
    expect(result.error).toBeUndefined();

    const data = result.data!;
    expect(data.urlHaus.query_status).toBe('no_results');
    expect(data.phishTank.in_database).toBe('false');
    expect(data.cloudmersive.CleanResult).toBe(true);
    expect(data.safeBrowsing.unsafe).toBe(false);
  });

  it('returns threat details when Google Safe Browsing finds a match', async () => {
    server.use(
      http.post('https://urlhaus-api.abuse.ch/v1/host/', () => {
        return HttpResponse.json({ query_status: 'no_results', urls: [] });
      }),
      http.post('https://checkurl.phishtank.com/checkurl/', () => {
        return new HttpResponse(
          `<?xml version="1.0" encoding="utf-8"?>
          <response>
            <results>
              <in_database>false</in_database>
            </results>
          </response>`,
          { headers: { 'Content-Type': 'application/xml' } },
        );
      }),
      http.post('https://api.cloudmersive.com/virus/scan/website', () => {
        return HttpResponse.json({ CleanResult: true, WebsiteThreatType: 'None' });
      }),
      http.post('https://safebrowsing.googleapis.com/v4/threatMatches:find', () => {
        return HttpResponse.json({
          matches: [{ threatType: 'MALWARE', platformType: 'ANY_PLATFORM' }],
        });
      }),
    );

    const result = await threatsHandler(TEST_URL, options);
    expect(result).toHaveProperty('data');

    const data = result.data!;
    expect(data.safeBrowsing.unsafe).toBe(true);
    expect(data.safeBrowsing.details).toHaveLength(1);
  });

  it('returns error messages for missing API keys', async () => {
    server.use(
      http.post('https://urlhaus-api.abuse.ch/v1/host/', () => {
        return HttpResponse.json({ query_status: 'no_results', urls: [] });
      }),
      http.post('https://checkurl.phishtank.com/checkurl/', () => {
        return new HttpResponse(
          `<?xml version="1.0" encoding="utf-8"?>
          <response>
            <results>
              <in_database>false</in_database>
            </results>
          </response>`,
          { headers: { 'Content-Type': 'application/xml' } },
        );
      }),
    );

    const result = await threatsHandler(TEST_URL, {});
    expect(result).toHaveProperty('data');

    const data = result.data!;
    expect(data.cloudmersive.error).toContain('CLOUDMERSIVE_API_KEY is required');
    expect(data.safeBrowsing.error).toContain('GOOGLE_CLOUD_API_KEY is required');
    // URLHaus and PhishTank don't require keys, so they should still work
    expect(data.urlHaus.error).toBeUndefined();
    expect(data.phishTank.error).toBeUndefined();
  });

  it('returns top-level error when all sub-requests fail', async () => {
    server.use(
      http.post('https://urlhaus-api.abuse.ch/v1/host/', () => {
        return HttpResponse.error();
      }),
      http.post('https://checkurl.phishtank.com/checkurl/', () => {
        return HttpResponse.error();
      }),
    );

    // No API keys provided => cloudmersive and safeBrowsing return errors too
    const result = await threatsHandler(TEST_URL, {});
    expect(result).toHaveProperty('error');
    expect(typeof result.error).toBe('string');
  });

  it('returns partial data when some requests fail with network errors', async () => {
    server.use(
      http.post('https://urlhaus-api.abuse.ch/v1/host/', () => {
        return HttpResponse.error();
      }),
      http.post('https://checkurl.phishtank.com/checkurl/', () => {
        return new HttpResponse(
          `<?xml version="1.0" encoding="utf-8"?>
          <response>
            <results>
              <in_database>false</in_database>
            </results>
          </response>`,
          { headers: { 'Content-Type': 'application/xml' } },
        );
      }),
      http.post('https://api.cloudmersive.com/virus/scan/website', () => {
        return HttpResponse.json({ CleanResult: true, WebsiteThreatType: 'None' });
      }),
      http.post('https://safebrowsing.googleapis.com/v4/threatMatches:find', () => {
        return HttpResponse.json({});
      }),
    );

    const result = await threatsHandler(TEST_URL, options);
    expect(result).toHaveProperty('data');

    const data = result.data!;
    // URLHaus failed
    expect(data.urlHaus.error).toBeDefined();
    // Others succeeded
    expect(data.phishTank.in_database).toBe('false');
    expect(data.cloudmersive.CleanResult).toBe(true);
    expect(data.safeBrowsing.unsafe).toBe(false);
  });
});
