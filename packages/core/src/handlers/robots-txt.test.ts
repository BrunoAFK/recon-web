import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { robotsTxtHandler } from './robots-txt.js';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const STANDARD_ROBOTS_TXT = `User-agent: *
Disallow: /admin
Disallow: /private/
Allow: /public

User-agent: Googlebot
Disallow: /no-google
Allow: /
`;

describe('robotsTxtHandler', () => {
  it('parses standard robots.txt content', async () => {
    server.use(
      http.get('https://mock-site.test/robots.txt', () => {
        return new HttpResponse(STANDARD_ROBOTS_TXT, { status: 200 });
      }),
    );

    const result = await robotsTxtHandler('https://mock-site.test');
    expect(result).toHaveProperty('data');
    expect(result.error).toBeUndefined();

    const rules = result.data!.robots;
    expect(Array.isArray(rules)).toBe(true);
    expect(rules.length).toBeGreaterThan(0);

    // Check that User-agent rules are parsed
    const userAgentRules = rules.filter((r) => r.lbl.toLowerCase() === 'user-agent');
    expect(userAgentRules.length).toBe(2);
    expect(userAgentRules[0].val).toBe('*');
    expect(userAgentRules[1].val).toBe('Googlebot');

    // Check Disallow rules
    const disallowRules = rules.filter((r) => r.lbl.toLowerCase() === 'disallow');
    expect(disallowRules.length).toBe(3);
    expect(disallowRules.map((r) => r.val)).toContain('/admin');
    expect(disallowRules.map((r) => r.val)).toContain('/private/');

    // Check Allow rules
    const allowRules = rules.filter((r) => r.lbl.toLowerCase() === 'allow');
    expect(allowRules.length).toBe(2);
  });

  it('returns informational data when robots.txt has no rules', async () => {
    server.use(
      http.get('https://mock-site.test/robots.txt', () => {
        return new HttpResponse('# Just a comment\n', { status: 200 });
      }),
    );

    const result = await robotsTxtHandler('https://mock-site.test');
    expect(result).toHaveProperty('data');
    expect(result.data?.robots).toEqual([]);
    expect(result.data?.message).toContain('No robots.txt rules');
  });

  it('returns error when robots.txt fetch fails', async () => {
    server.use(
      http.get('https://mock-site.test/robots.txt', () => {
        return HttpResponse.error();
      }),
    );

    const result = await robotsTxtHandler('https://mock-site.test');
    expect(result).toHaveProperty('error');
    expect(typeof result.error).toBe('string');
  });

  it('returns error for invalid URL', async () => {
    const result = await robotsTxtHandler('not a valid url at all %%%');
    expect(result).toHaveProperty('error');
  });
});
