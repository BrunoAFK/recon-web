import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('dns/promises', () => ({
  default: {
    lookup: vi.fn(),
  },
}));

import dns from 'dns/promises';
import { getIpHandler } from './get-ip.js';

const mockedLookup = vi.mocked(dns.lookup);

describe('getIpHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns IP data for example.com', async () => {
    mockedLookup.mockResolvedValue({ address: '93.184.216.34', family: 4 } as never);

    const result = await getIpHandler('example.com');
    expect(result).toHaveProperty('data');
    expect(result.error).toBeUndefined();

    const data = result.data!;
    expect(data).toHaveProperty('ip', '93.184.216.34');
    expect(data).toHaveProperty('family', 4);
  });

  it('returns an error for an invalid domain', async () => {
    mockedLookup.mockRejectedValue(new Error('getaddrinfo ENOTFOUND invalid'));

    const result = await getIpHandler('this-domain-does-not-exist-xyz123.invalid');
    expect(result).toHaveProperty('error');
    expect(typeof result.error).toBe('string');
  });
});
