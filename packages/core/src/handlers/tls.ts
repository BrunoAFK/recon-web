import tls from 'node:tls';
import type { AnalysisHandler } from '../types.js';
import { extractHostname } from '../utils/url.js';

export interface TlsResult {
  target?: string;
  has_tls?: boolean;
  is_valid?: boolean;
  completion_perc?: number;
  connection_info?: {
    protocol?: string;
    cipher?: string;
    cert_valid?: boolean;
  };
  analysis?: Record<string, unknown>[];
  [key: string]: unknown;
}

export const tlsHandler: AnalysisHandler<TlsResult> = async (url, options) => {
  const domain = extractHostname(url);
  const timeout = options?.timeout ?? 10_000;

  return new Promise((resolve) => {
    const socket = tls.connect(
      { host: domain, port: 443, rejectUnauthorized: false, servername: domain },
      () => {
        try {
          const cipher = socket.getCipher();
          const protocol = socket.getProtocol();
          const cert = socket.getPeerCertificate();
          const authorized = socket.authorized;

          const analysis: Record<string, unknown>[] = [];

          if (cert && cert.subject) {
            analysis.push({
              id: 'certificate',
              subject: cert.subject,
              issuer: cert.issuer,
              valid_from: cert.valid_from,
              valid_to: cert.valid_to,
              serialNumber: cert.serialNumber,
              fingerprint256: cert.fingerprint256,
            });
          }

          socket.destroy();
          resolve({
            data: {
              target: domain,
              has_tls: true,
              is_valid: authorized,
              completion_perc: 100,
              connection_info: {
                protocol: protocol ?? undefined,
                cipher: cipher?.name ?? undefined,
                cert_valid: authorized,
              },
              analysis,
            },
          });
        } catch {
          socket.destroy();
          resolve({ error: 'Failed to read TLS connection details', errorCode: 'NO_DATA', errorCategory: 'site' });
        }
      },
    );

    socket.setTimeout(timeout, () => {
      socket.destroy();
      resolve({ error: `TLS connection timed out after ${timeout}ms`, errorCode: 'TIMEOUT', errorCategory: 'site' });
    });

    socket.on('error', (err) => {
      socket.destroy();
      if (err.message.includes('ENOTFOUND') || err.message.includes('ECONNREFUSED')) {
        resolve({ error: `Could not connect to ${domain}:443`, errorCode: 'CONNECTION_REFUSED', errorCategory: 'site' });
      } else {
        resolve({ error: err.message });
      }
    });
  });
};
