import { describe, it, expect, vi, afterEach } from 'vitest';
import { screenshotHandler } from './screenshot.js';
import * as dns from 'node:dns/promises';

vi.mock('node:dns/promises');

describe('screenshot handler — SSRF', () => {
  afterEach(() => vi.restoreAllMocks());

  it('refuses to screenshot a hostname that resolves to metadata IP', async () => {
    vi.spyOn(dns, 'lookup').mockResolvedValueOnce({ address: '169.254.169.254', family: 4 });
    const result = await screenshotHandler('http://metadata.example.com/', {});
    expect(result.error).toMatch(/private address|Blocked/i);
    expect(result.data).toBeUndefined();
  });

  it('rejects file:// URLs outright', async () => {
    const result = await screenshotHandler('file:///etc/passwd', {});
    expect(result.error).toBeDefined();
    expect(result.data).toBeUndefined();
  });

  it('rejects loopback hostnames', async () => {
    vi.spyOn(dns, 'lookup').mockResolvedValueOnce({ address: '127.0.0.1', family: 4 });
    const result = await screenshotHandler('http://localhost-spoof.example.com/', {});
    expect(result.error).toMatch(/private address|Blocked/i);
    expect(result.data).toBeUndefined();
  });
});
