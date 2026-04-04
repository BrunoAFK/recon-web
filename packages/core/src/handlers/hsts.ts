import https from 'https';
import type { AnalysisHandler, HandlerResult } from '../types.js';
import { normalizeUrl } from '../utils/url.js';

export interface HstsResult {
  message: string;
  compatible: boolean;
  hstsHeader: string | null;
}

export const hstsHandler: AnalysisHandler<HstsResult> = async (url, options) => {
  try {
    const fullUrl = normalizeUrl(url);

    const result = await new Promise<HstsResult>((resolve, reject) => {
      const req = https.request(fullUrl, (res) => {
        const headers = res.headers;
        const hstsHeader = headers['strict-transport-security'] ?? null;

        if (!hstsHeader) {
          resolve({
            message: 'Site does not serve any HSTS headers.',
            compatible: false,
            hstsHeader: null,
          });
          return;
        }

        const maxAgeMatch = hstsHeader.match(/max-age=(\d+)/);
        const includesSubDomains = hstsHeader.includes('includeSubDomains');
        const preload = hstsHeader.includes('preload');

        if (!maxAgeMatch || parseInt(maxAgeMatch[1], 10) < 10886400) {
          resolve({
            message: 'HSTS max-age is less than 10886400.',
            compatible: false,
            hstsHeader: null,
          });
        } else if (!includesSubDomains) {
          resolve({
            message: 'HSTS header does not include all subdomains.',
            compatible: false,
            hstsHeader: null,
          });
        } else if (!preload) {
          resolve({
            message: 'HSTS header does not contain the preload directive.',
            compatible: false,
            hstsHeader: null,
          });
        } else {
          resolve({
            message: 'Site is compatible with the HSTS preload list!',
            compatible: true,
            hstsHeader,
          });
        }
      });

      req.on('error', (error) => {
        reject(new Error(`Error making request: ${error.message}`));
      });

      req.end();
    });

    return { data: result };
  } catch (error) {
    return { error: (error as Error).message };
  }
};
