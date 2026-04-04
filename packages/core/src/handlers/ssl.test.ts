import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sslHandler } from './ssl.js';
import type { TLSSocket, ConnectionOptions } from 'tls';
import { EventEmitter } from 'events';

// Mock the tls module
vi.mock('tls', () => {
  return {
    default: {
      connect: vi.fn(),
    },
  };
});

import tls from 'tls';

const mockedConnect = vi.mocked(tls.connect);

function createMockSocket(options: {
  authorized?: boolean;
  authorizationError?: string;
  cert?: Record<string, unknown>;
}): EventEmitter & Partial<TLSSocket> {
  const socket = new EventEmitter() as EventEmitter & Partial<TLSSocket>;
  socket.authorized = options.authorized ?? true;
  socket.authorizationError = (options.authorizationError ?? '') as any;
  socket.getPeerCertificate = vi.fn().mockReturnValue(options.cert ?? {});
  socket.end = vi.fn();
  return socket;
}

const VALID_CERT = {
  subject: { CN: 'example.com', O: 'Example Inc' },
  issuer: { CN: "Let's Encrypt Authority X3", O: "Let's Encrypt" },
  subjectaltname: 'DNS:example.com, DNS:www.example.com',
  valid_from: 'Jan 01 00:00:00 2024 GMT',
  valid_to: 'Apr 01 00:00:00 2025 GMT',
  fingerprint: 'AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD',
  fingerprint256: 'AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99',
  serialNumber: '0123456789ABCDEF',
  raw: Buffer.from('raw-cert-data'),
  issuerCertificate: { subject: { CN: "Let's Encrypt" } },
};

describe('sslHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns certificate data for a valid SSL connection', async () => {
    const socket = createMockSocket({
      authorized: true,
      cert: VALID_CERT,
    });

    mockedConnect.mockImplementation((_opts: any, callback?: () => void) => {
      // Invoke the callback asynchronously to simulate TLS connection
      process.nextTick(() => callback?.());
      return socket as any;
    });

    const result = await sslHandler('https://example.com');
    expect(result).toHaveProperty('data');
    expect(result.error).toBeUndefined();

    const data = result.data!;
    expect(data.subject).toEqual({ CN: 'example.com', O: 'Example Inc' });
    expect(data.issuer).toEqual({ CN: "Let's Encrypt Authority X3", O: "Let's Encrypt" });
    expect(data.valid_from).toBe('Jan 01 00:00:00 2024 GMT');
    expect(data.valid_to).toBe('Apr 01 00:00:00 2025 GMT');
    expect(data.fingerprint).toBeDefined();
    expect(data.serialNumber).toBe('0123456789ABCDEF');
    // raw and issuerCertificate should be stripped
    expect((data as any).raw).toBeUndefined();
    expect((data as any).issuerCertificate).toBeUndefined();
  });

  it('returns error on TLS connection error', async () => {
    const socket = createMockSocket({});

    mockedConnect.mockImplementation((_opts: any, _callback?: () => void) => {
      process.nextTick(() => socket.emit('error', new Error('ECONNREFUSED')));
      return socket as any;
    });

    const result = await sslHandler('https://example.com');
    expect(result).toHaveProperty('error');
    expect(result.error).toContain('Error fetching site certificate');
    expect(result.error).toContain('ECONNREFUSED');
  });

  it('returns error when SSL handshake is not authorized', async () => {
    const socket = createMockSocket({
      authorized: false,
      authorizationError: 'CERT_HAS_EXPIRED',
    });

    mockedConnect.mockImplementation((_opts: any, callback?: () => void) => {
      process.nextTick(() => callback?.());
      return socket as any;
    });

    const result = await sslHandler('https://example.com');
    expect(result).toHaveProperty('error');
    expect(result.error).toContain('SSL handshake not authorized');
    expect(result.error).toContain('CERT_HAS_EXPIRED');
  });

  it('returns error when no certificate is presented', async () => {
    const socket = createMockSocket({
      authorized: true,
      cert: {},
    });

    mockedConnect.mockImplementation((_opts: any, callback?: () => void) => {
      process.nextTick(() => callback?.());
      return socket as any;
    });

    const result = await sslHandler('https://example.com');
    expect(result).toHaveProperty('error');
    expect(result.error).toContain('No certificate presented');
  });

  it('uses correct host and port from URL', async () => {
    const socket = createMockSocket({
      authorized: true,
      cert: VALID_CERT,
    });

    mockedConnect.mockImplementation((_opts: any, callback?: () => void) => {
      process.nextTick(() => callback?.());
      return socket as any;
    });

    await sslHandler('https://example.com:8443');

    expect(mockedConnect).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'example.com',
        port: 8443,
        servername: 'example.com',
      }),
      expect.any(Function),
    );
  });
});
