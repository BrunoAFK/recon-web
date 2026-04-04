import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('dns/promises', () => ({
  default: {
    lookup: vi.fn(),
    resolve6: vi.fn(),
    resolveMx: vi.fn(),
    resolveTxt: vi.fn(),
    resolveNs: vi.fn(),
    resolveCname: vi.fn(),
    resolveSoa: vi.fn(),
    resolveSrv: vi.fn(),
    resolvePtr: vi.fn(),
  },
}));

import dns from 'dns/promises';
import { dnsHandler } from './dns.js';

const mockedDns = vi.mocked(dns);

describe('dnsHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns DNS data for example.com', async () => {
    mockedDns.lookup.mockResolvedValue({ address: '93.184.216.34', family: 4 } as never);
    mockedDns.resolve6.mockResolvedValue(['2606:2800:220:1:248:1893:25c8:1946'] as never);
    mockedDns.resolveMx.mockResolvedValue([{ exchange: 'mail.example.com', priority: 10 }] as never);
    mockedDns.resolveTxt.mockResolvedValue([['v=spf1 -all']] as never);
    mockedDns.resolveNs.mockResolvedValue(['a.iana-servers.net'] as never);
    mockedDns.resolveCname.mockResolvedValue([] as never);
    mockedDns.resolveSoa.mockResolvedValue({
      nsname: 'a.iana-servers.net',
      hostmaster: 'hostmaster.example.com',
      serial: 2025010101,
      refresh: 7200,
      retry: 3600,
      expire: 1209600,
      minttl: 3600,
    } as never);
    mockedDns.resolveSrv.mockResolvedValue([] as never);
    mockedDns.resolvePtr.mockResolvedValue([] as never);

    const result = await dnsHandler('example.com');
    expect(result).toHaveProperty('data');
    expect(result.error).toBeUndefined();

    const data = result.data!;
    expect(data).toHaveProperty('A');
    expect(data.A).toHaveProperty('address', '93.184.216.34');
    expect(data.A).toHaveProperty('family', 4);
    expect(data).toHaveProperty('AAAA');
    expect(data).toHaveProperty('MX');
    expect(data).toHaveProperty('NS');
    expect(data).toHaveProperty('TXT');
    expect(data).toHaveProperty('CNAME');
    expect(data).toHaveProperty('SOA');
    expect(data).toHaveProperty('SRV');
    expect(data).toHaveProperty('PTR');
  });

  it('returns an error for an invalid domain', async () => {
    mockedDns.lookup.mockRejectedValue(new Error('getaddrinfo ENOTFOUND invalid'));

    const result = await dnsHandler('this-domain-does-not-exist-xyz123.invalid');
    expect(result).toHaveProperty('error');
    expect(typeof result.error).toBe('string');
  });

  it('result matches HandlerResult shape', async () => {
    mockedDns.lookup.mockResolvedValue({ address: '93.184.216.34', family: 4 } as never);
    mockedDns.resolve6.mockResolvedValue([] as never);
    mockedDns.resolveMx.mockResolvedValue([] as never);
    mockedDns.resolveTxt.mockResolvedValue([] as never);
    mockedDns.resolveNs.mockResolvedValue([] as never);
    mockedDns.resolveCname.mockResolvedValue([] as never);
    mockedDns.resolveSoa.mockResolvedValue(null as never);
    mockedDns.resolveSrv.mockResolvedValue([] as never);
    mockedDns.resolvePtr.mockResolvedValue([] as never);

    const result = await dnsHandler('example.com');
    const hasDataOrError = 'data' in result || 'error' in result;
    expect(hasDataOrError).toBe(true);
  });
});
