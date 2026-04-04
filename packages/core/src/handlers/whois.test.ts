import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'events';
import { getWhoisServer } from './whois-servers.js';
import { parseWhoisData } from './whois.js';

// ─── Mock net module ────────────────────────────────────────────────────────

class MockSocket extends EventEmitter {
  write = vi.fn();
  setTimeout = vi.fn();
  destroy = vi.fn();
}

let mockSocket: MockSocket;

vi.mock('net', () => ({
  default: {
    createConnection: vi.fn((_opts: unknown, cb: () => void) => {
      mockSocket = new MockSocket();
      // Simulate async connect callback
      process.nextTick(cb);
      return mockSocket;
    }),
  },
}));

// Must import after vi.mock so the mock is in place
import net from 'net';
import { whoisHandler } from './whois.js';

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── parseWhoisData ─────────────────────────────────────────────────────────

describe('parseWhoisData', () => {
  it('parses WHOIS response with \\r\\n line endings', () => {
    const raw =
      'Domain Name: EXAMPLE.COM\r\n' +
      'Registrar: Example Registrar, Inc.\r\n' +
      'Creation Date: 1995-08-14\r\n';
    const result = parseWhoisData(raw);
    expect(result).toEqual({
      Domain_Name: 'EXAMPLE.COM',
      Registrar: 'Example Registrar, Inc.',
      Creation_Date: '1995-08-14',
    });
  });

  it('parses WHOIS response with \\n line endings', () => {
    const raw =
      'Domain Name: EXAMPLE.ORG\n' +
      'Registrar: Another Registrar\n' +
      'Updated Date: 2024-01-01\n';
    const result = parseWhoisData(raw);
    expect(result).toEqual({
      Domain_Name: 'EXAMPLE.ORG',
      Registrar: 'Another Registrar',
      Updated_Date: '2024-01-01',
    });
  });

  it('returns error object when "No match for" is present', () => {
    const raw = 'No match for domain "NOTEXIST.COM".\r\n';
    const result = parseWhoisData(raw);
    expect(result).toHaveProperty('error');
    expect((result as { error: string }).error).toContain('No matches found');
  });

  it('returns error object when "NOT FOUND" is present', () => {
    const raw = 'NOT FOUND\n';
    const result = parseWhoisData(raw);
    expect(result).toHaveProperty('error');
  });

  it('handles continuation lines (no colon)', () => {
    const raw =
      'Domain Name: EXAMPLE.COM\r\n' +
      'Name Server: ns1.example.com\r\n' +
      '   secondary info here\r\n' +
      'Registrar: Test\r\n';
    const result = parseWhoisData(raw) as Record<string, string>;
    expect(result.Name_Server).toContain('secondary info here');
  });

  it('ignores continuation lines before the first key', () => {
    const raw =
      '   orphan line without a key\r\n' +
      'Domain Name: EXAMPLE.COM\r\n' +
      'Registrar: Test\r\n';
    const result = parseWhoisData(raw) as Record<string, string>;
    expect(result.Domain_Name).toBe('EXAMPLE.COM');
    expect(result.Registrar).toBe('Test');
    expect(Object.keys(result)).toHaveLength(2);
  });
});

// ─── getWhoisServer ─────────────────────────────────────────────────────────

describe('getWhoisServer', () => {
  it('returns correct server for well-known TLDs', () => {
    expect(getWhoisServer('com')).toBe('whois.verisign-grs.com');
    expect(getWhoisServer('org')).toBe('whois.pir.org');
    expect(getWhoisServer('io')).toBe('whois.nic.io');
    expect(getWhoisServer('de')).toBe('whois.denic.de');
    expect(getWhoisServer('jp')).toBe('whois.jprs.jp');
    expect(getWhoisServer('hr')).toBe('whois.dns.hr');
  });

  it('returns correct server for multi-part TLDs', () => {
    expect(getWhoisServer('co.uk')).toBe('whois.nic.uk');
    expect(getWhoisServer('com.hr')).toBe('whois.dns.hr');
    expect(getWhoisServer('com.au')).toBe('whois.auda.org.au');
    expect(getWhoisServer('co.jp')).toBe('whois.jprs.jp');
  });

  it('returns undefined for unknown TLDs', () => {
    expect(getWhoisServer('zzz')).toBeUndefined();
    expect(getWhoisServer('nonexistent')).toBeUndefined();
  });

  it('is case-insensitive', () => {
    expect(getWhoisServer('COM')).toBe('whois.verisign-grs.com');
    expect(getWhoisServer('Co.Uk')).toBe('whois.nic.uk');
  });
});

// ─── whoisHandler (socket flow) ─────────────────────────────────────────────

describe('whoisHandler', () => {
  it('returns parsed WHOIS data on successful query', async () => {
    const promise = whoisHandler('https://example.com');

    // Wait for createConnection callback to fire
    await vi.waitFor(() => {
      expect(mockSocket.write).toHaveBeenCalled();
    });

    // Simulate data arriving and connection closing
    mockSocket.emit('data', Buffer.from('Domain Name: EXAMPLE.COM\r\nRegistrar: Test Reg\r\n'));
    mockSocket.emit('end');

    const result = await promise;
    expect(result.data).toBeDefined();
    expect(result.data!.Domain_Name).toBe('EXAMPLE.COM');
    expect(result.error).toBeUndefined();
  });

  it('sets socket timeout from options', async () => {
    const promise = whoisHandler('https://example.com', { timeout: 5000 });

    await vi.waitFor(() => {
      expect(mockSocket.setTimeout).toHaveBeenCalledWith(5000);
    });

    mockSocket.emit('data', Buffer.from('Domain Name: EXAMPLE.COM\r\n'));
    mockSocket.emit('end');

    await promise;
  });

  it('returns error on timeout', async () => {
    const promise = whoisHandler('https://example.com');

    await vi.waitFor(() => {
      expect(mockSocket.setTimeout).toHaveBeenCalled();
    });

    mockSocket.emit('timeout');

    const result = await promise;
    expect(result.error).toContain('timed out');
    expect(mockSocket.destroy).toHaveBeenCalled();
  });

  it('returns error for "No match" results', async () => {
    const promise = whoisHandler('https://nonexistent-domain-xyz.com');

    await vi.waitFor(() => {
      expect(mockSocket.write).toHaveBeenCalled();
    });

    mockSocket.emit('data', Buffer.from('No match for domain "NONEXISTENT-DOMAIN-XYZ.COM".\r\n'));
    mockSocket.emit('end');

    const result = await promise;
    expect(result.error).toBeDefined();
    expect(result.error).toContain('No matches found');
    expect(result.data).toBeUndefined();
  });

  it('retries once on ECONNREFUSED then returns error', async () => {
    // First attempt: connection error
    const promise = whoisHandler('https://example.com');

    await vi.waitFor(() => {
      expect(mockSocket).toBeDefined();
    });

    const firstSocket = mockSocket;
    const connError = new Error('Connection refused') as NodeJS.ErrnoException;
    connError.code = 'ECONNREFUSED';
    firstSocket.emit('error', connError);

    // Second attempt: also fails
    await vi.waitFor(() => {
      expect((net.createConnection as ReturnType<typeof vi.fn>).mock.calls.length).toBe(2);
    });

    const secondSocket = mockSocket;
    secondSocket.emit('error', connError);

    const result = await promise;
    expect(result.error).toContain('Connection refused');
    expect((net.createConnection as ReturnType<typeof vi.fn>).mock.calls.length).toBe(2);
  });

  it('returns error on invalid URL', async () => {
    const result = await whoisHandler('://not-a-url');
    expect(result.error).toBeDefined();
    expect(result.error).toContain('Unable to parse URL');
  });

  it('handles URL without protocol', async () => {
    const promise = whoisHandler('example.de');

    await vi.waitFor(() => {
      expect(mockSocket.write).toHaveBeenCalled();
    });

    // Check that the correct WHOIS server is used (denic for .de)
    expect((net.createConnection as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
      expect.objectContaining({ host: 'whois.denic.de', port: 43 }),
      expect.any(Function),
    );

    mockSocket.emit('data', Buffer.from('Domain: example.de\nStatus: connect\n'));
    mockSocket.emit('end');

    const result = await promise;
    expect(result.data).toBeDefined();
  });
});
