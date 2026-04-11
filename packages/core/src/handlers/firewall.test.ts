import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { firewallHandler } from './firewall.js';
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

describe('firewallHandler', () => {
  it('detects Cloudflare WAF from server header', async () => {
    server.use(
      http.get('https://mock-site.test/', () => {
        return new HttpResponse('OK', {
          status: 200,
          headers: { server: 'cloudflare' },
        });
      }),
    );

    const result = await firewallHandler('https://mock-site.test');
    expect(result).toHaveProperty('data');
    expect(result.data!.hasWaf).toBe(true);
    expect(result.data!.waf).toBe('Cloudflare');
  });

  it('detects Akamai WAF from server header', async () => {
    server.use(
      http.get('https://mock-site.test/', () => {
        return new HttpResponse('OK', {
          status: 200,
          headers: { server: 'AkamaiGHost' },
        });
      }),
    );

    const result = await firewallHandler('https://mock-site.test');
    expect(result).toHaveProperty('data');
    expect(result.data!.hasWaf).toBe(true);
    expect(result.data!.waf).toBe('Akamai');
  });

  it('detects Sucuri WAF from custom header', async () => {
    server.use(
      http.get('https://mock-site.test/', () => {
        return new HttpResponse('OK', {
          status: 200,
          headers: { 'x-sucuri-id': '12345' },
        });
      }),
    );

    const result = await firewallHandler('https://mock-site.test');
    expect(result).toHaveProperty('data');
    expect(result.data!.hasWaf).toBe(true);
    expect(result.data!.waf).toBe('Sucuri CloudProxy WAF');
  });

  it('returns hasWaf false when no WAF is detected', async () => {
    server.use(
      http.get('https://mock-site.test/', () => {
        return new HttpResponse('OK', {
          status: 200,
          headers: { server: 'nginx' },
        });
      }),
    );

    const result = await firewallHandler('https://mock-site.test');
    expect(result).toHaveProperty('data');
    expect(result.data!.hasWaf).toBe(false);
    expect(result.data!.waf).toBeUndefined();
  });

  it('returns error on network failure', async () => {
    server.use(
      http.get('https://mock-site.test/', () => {
        return HttpResponse.error();
      }),
    );

    const result = await firewallHandler('https://mock-site.test');
    expect(result).toHaveProperty('error');
    expect(typeof result.error).toBe('string');
  });
});

describe('firewall handler — SSRF', () => {
  it('refuses to fetch a hostname that resolves to AWS metadata IP', async () => {
    vi.spyOn(dns, 'lookup').mockResolvedValueOnce({ address: '169.254.169.254', family: 4 });
    const result = await firewallHandler('http://metadata.example.com/');
    expect(result.error).toMatch(/private address|Blocked/i);
    expect(result.data).toBeUndefined();
  });
});
