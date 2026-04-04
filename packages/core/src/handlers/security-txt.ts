import https from 'https';
import type { AnalysisHandler, HandlerResult } from '../types.js';
import { normalizeUrl } from '../utils/url.js';

const SECURITY_TXT_PATHS = ['/security.txt', '/.well-known/security.txt'];

export interface SecurityTxtResult {
  isPresent: boolean;
  foundIn?: string;
  content?: string;
  isPgpSigned?: boolean;
  fields?: Record<string, string>;
}

const parseResult = (result: string): Record<string, string> => {
  const output: Record<string, string> = {};
  const counts: Record<string, number> = {};
  const lines = result.split('\n');
  const regex = /^([^:]+):\s*(.+)$/;

  for (const line of lines) {
    if (!line.startsWith('#') && !line.startsWith('-----') && line.trim() !== '') {
      const match = line.match(regex);
      if (match && match.length > 2) {
        let key = match[1].trim();
        const value = match[2].trim();
        if (key in output) {
          counts[key] = counts[key] ? counts[key] + 1 : 1;
          key += counts[key];
        }
        output[key] = value;
      }
    }
  }

  return output;
};

const isPgpSigned = (result: string): boolean => {
  return result.includes('-----BEGIN PGP SIGNED MESSAGE-----');
};

const fetchSecurityTxt = (baseURL: URL, path: string): Promise<string | null> => {
  return new Promise((resolve, reject) => {
    const targetUrl = new URL(path, baseURL);
    https
      .get(targetUrl.toString(), (res) => {
        if (res.statusCode === 200) {
          let data = '';
          res.on('data', (chunk: Buffer) => {
            data += chunk;
          });
          res.on('end', () => {
            resolve(data);
          });
        } else {
          resolve(null);
        }
      })
      .on('error', (err) => {
        reject(err);
      });
  });
};

export const securityTxtHandler: AnalysisHandler<SecurityTxtResult> = async (url, options) => {
  try {
    const normalized = normalizeUrl(url);
    const baseURL = new URL(normalized);
    baseURL.pathname = '';

    for (const path of SECURITY_TXT_PATHS) {
      const result = await fetchSecurityTxt(baseURL, path);
      if (result && result.includes('<html')) {
        return { data: { isPresent: false } };
      }
      if (result) {
        return {
          data: {
            isPresent: true,
            foundIn: path,
            content: result,
            isPgpSigned: isPgpSigned(result),
            fields: parseResult(result),
          },
        };
      }
    }

    return { data: { isPresent: false } };
  } catch (error) {
    return { error: (error as Error).message };
  }
};
