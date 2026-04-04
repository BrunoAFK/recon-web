import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { techStackHandler } from './tech-stack.js';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const TEST_URL = 'https://mock-site.test/';

describe('techStackHandler', () => {
  it('detects WordPress from HTML patterns', async () => {
    server.use(
      http.get(TEST_URL, () => {
        return new HttpResponse(
          `<!DOCTYPE html>
          <html>
          <head>
            <meta name="generator" content="WordPress 6.4" />
            <link rel="stylesheet" href="https://mock-site.test/wp-content/themes/theme/style.css" />
          </head>
          <body>
            <script src="https://mock-site.test/wp-includes/js/jquery/jquery.min.js"></script>
          </body>
          </html>`,
          {
            status: 200,
            headers: {
              'Content-Type': 'text/html',
              'X-Powered-By': 'PHP/8.2',
            },
          },
        );
      }),
    );

    const result = await techStackHandler(TEST_URL);
    expect(result).toHaveProperty('data');
    expect(result.error).toBeUndefined();

    const techs = result.data!.technologies;
    const names = techs.map((t) => t.name);
    expect(names).toContain('WordPress');
    expect(names).toContain('jQuery');
    expect(names).toContain('PHP');
  });

  it('detects React and Next.js from HTML patterns', async () => {
    server.use(
      http.get(TEST_URL, () => {
        return new HttpResponse(
          `<!DOCTYPE html>
          <html>
          <head>
            <meta name="generator" content="Next.js" />
          </head>
          <body>
            <div id="__next" data-reactroot="">
              <script id="__NEXT_DATA__" type="application/json">{"props":{}}</script>
            </div>
            <script src="/_next/static/chunks/react.production.min.js"></script>
          </body>
          </html>`,
          {
            status: 200,
            headers: {
              'Content-Type': 'text/html',
              server: 'Vercel',
              'x-vercel-id': 'abc123',
            },
          },
        );
      }),
    );

    const result = await techStackHandler(TEST_URL);
    expect(result).toHaveProperty('data');

    const techs = result.data!.technologies;
    const names = techs.map((t) => t.name);
    expect(names).toContain('React');
    expect(names).toContain('Next.js');
    expect(names).toContain('Vercel');
  });

  it('returns informational data when no technologies are detected', async () => {
    server.use(
      http.get(TEST_URL, () => {
        return new HttpResponse(
          `<!DOCTYPE html>
          <html>
          <head><title>Plain page</title></head>
          <body><p>Hello world</p></body>
          </html>`,
          {
            status: 200,
            headers: { 'Content-Type': 'text/html' },
          },
        );
      }),
    );

    const result = await techStackHandler(TEST_URL);
    expect(result).toHaveProperty('data');
    expect(result.data?.message).toContain('No technologies were confidently detected');
    expect(result.data?.technologies).toEqual([]);
  });

  it('returns error on network failure', async () => {
    server.use(
      http.get(TEST_URL, () => {
        return HttpResponse.error();
      }),
    );

    const result = await techStackHandler(TEST_URL);
    expect(result).toHaveProperty('error');
    expect(typeof result.error).toBe('string');
    expect(result.data).toBeUndefined();
  });

  it('detects technologies from response headers', async () => {
    server.use(
      http.get(TEST_URL, () => {
        return new HttpResponse(
          `<!DOCTYPE html><html><head></head><body></body></html>`,
          {
            status: 200,
            headers: {
              'Content-Type': 'text/html',
              server: 'nginx',
              'x-powered-by': 'Express',
            },
          },
        );
      }),
    );

    const result = await techStackHandler(TEST_URL);
    expect(result).toHaveProperty('data');

    const techs = result.data!.technologies;
    const names = techs.map((t) => t.name);
    expect(names).toContain('Nginx');
    expect(names).toContain('Express');
  });
});
