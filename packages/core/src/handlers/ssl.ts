import tls from 'tls';
import type { AnalysisHandler, HandlerResult } from '../types.js';
import { normalizeUrl } from '../utils/url.js';

export interface SslResult {
  subject: Record<string, string>;
  issuer: Record<string, string>;
  subjectaltname?: string;
  infoAccess?: Record<string, string[]>;
  modulus?: string;
  exponent?: string;
  valid_from: string;
  valid_to: string;
  fingerprint: string;
  fingerprint256: string;
  fingerprint512?: string;
  serialNumber: string;
  [key: string]: unknown;
}

export const sslHandler: AnalysisHandler<SslResult> = async (url, options) => {
  try {
    const parsedUrl = new URL(normalizeUrl(url));
    const connectOptions: tls.ConnectionOptions = {
      host: parsedUrl.hostname,
      port: Number(parsedUrl.port) || 443,
      servername: parsedUrl.hostname,
      rejectUnauthorized: false,
    };

    const result = await new Promise<SslResult>((resolve, reject) => {
      const socket = tls.connect(connectOptions, () => {
        if (!socket.authorized) {
          return reject(
            new Error(`SSL handshake not authorized. Reason: ${socket.authorizationError}`),
          );
        }

        const cert = socket.getPeerCertificate(true);
        if (!cert || Object.keys(cert).length === 0) {
          return reject(
            new Error(
              'No certificate presented by the server. ' +
              'The server is possibly not using SNI (Server Name Indication) to identify itself, ' +
              'and you are connecting to a hostname-aliased IP address. ' +
              'Or it may be due to an invalid SSL certificate, or an incomplete SSL handshake at the time the cert is being read.',
            ),
          );
        }

        const { raw, issuerCertificate, ...certWithoutRaw } = cert;
        resolve(certWithoutRaw as SslResult);
        socket.end();
      });

      socket.on('error', (error) => {
        reject(new Error(`Error fetching site certificate: ${error.message}`));
      });
    });

    return { data: result };
  } catch (error) {
    return { error: (error as Error).message };
  }
};
