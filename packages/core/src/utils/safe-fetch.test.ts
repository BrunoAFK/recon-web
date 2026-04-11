import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { safeFetch, SafeFetchError } from './safe-fetch.js';
import * as dns from 'node:dns/promises';

// Required for vi.spyOn to work on ESM non-configurable exports
vi.mock('node:dns/promises');

describe('safeFetch', () => {
  beforeEach(() => {
    delete process.env.RECON_ALLOW_PRIVATE_IPS;
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects non-http(s) URLs', async () => {
    await expect(safeFetch('file:///etc/passwd')).rejects.toThrow(SafeFetchError);
    await expect(safeFetch('gopher://example.com/')).rejects.toThrow(SafeFetchError);
    await expect(safeFetch('ftp://example.com/')).rejects.toThrow(SafeFetchError);
  });

  it('rejects when hostname resolves to private IP', async () => {
    vi.spyOn(dns, 'lookup').mockResolvedValueOnce({ address: '169.254.169.254', family: 4 });
    await expect(safeFetch('http://metadata.example.com/')).rejects.toThrow(/private address/);
  });

  it('rejects when hostname resolves to loopback', async () => {
    vi.spyOn(dns, 'lookup').mockResolvedValueOnce({ address: '127.0.0.1', family: 4 });
    await expect(safeFetch('http://localhost-impostor.example.com/')).rejects.toThrow(/private address/);
  });

  it('rejects ULA IPv6 addresses', async () => {
    vi.spyOn(dns, 'lookup').mockResolvedValueOnce({ address: 'fd00::1', family: 6 });
    await expect(safeFetch('http://internal.example.com/')).rejects.toThrow(/private address/);
  });

  it('allows RECON_ALLOW_PRIVATE_IPS escape hatch', async () => {
    process.env.RECON_ALLOW_PRIVATE_IPS = '1';
    vi.spyOn(dns, 'lookup').mockResolvedValueOnce({ address: '127.0.0.1', family: 4 });
    await expect(safeFetch('http://localhost.test/'))
      .rejects.not.toThrow(/private address/);
  });

  it('rejects redirects whose Location resolves to private IP', async () => {
    vi.spyOn(dns, 'lookup')
      .mockResolvedValueOnce({ address: '93.184.216.34', family: 4 })
      .mockResolvedValueOnce({ address: '169.254.169.254', family: 4 });

    const fakeAdapter = vi.fn(async (cfg: { url: string }) => {
      if (cfg.url === 'http://example.com/') {
        return { status: 301, headers: { location: 'http://metadata.example.com/' }, data: '', config: cfg };
      }
      return { status: 200, headers: {}, data: 'should not reach', config: cfg };
    });
    await expect(safeFetch('http://example.com/', { _adapter: fakeAdapter })).rejects.toThrow(/private address/);
  });

  it('enforces body size limit', async () => {
    vi.spyOn(dns, 'lookup').mockResolvedValueOnce({ address: '93.184.216.34', family: 4 });
    const fakeAdapter = vi.fn(async (cfg: { url: string }) => ({
      status: 200,
      headers: { 'content-length': String(50 * 1024 * 1024) },
      data: '',
      config: cfg,
    }));
    await expect(safeFetch('http://example.com/', { _adapter: fakeAdapter, maxBytes: 10 * 1024 * 1024 }))
      .rejects.toThrow(/too large/i);
  });

  it('enforces redirect chain depth limit', async () => {
    vi.spyOn(dns, 'lookup').mockResolvedValue({ address: '93.184.216.34', family: 4 });
    let n = 0;
    const fakeAdapter = vi.fn(async (cfg: { url: string }) => {
      n++;
      return { status: 301, headers: { location: `http://example.com/r${n}` }, data: '', config: cfg };
    });
    await expect(safeFetch('http://example.com/', { _adapter: fakeAdapter, maxRedirects: 3 }))
      .rejects.toThrow(/too many redirects/i);
  });
});
