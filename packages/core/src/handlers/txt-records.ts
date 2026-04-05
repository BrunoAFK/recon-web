import dns from 'dns/promises';
import psl from 'psl';
import type { AnalysisHandler, HandlerResult } from '../types.js';
import { extractHostname } from '../utils/url.js';

export interface TxtRecordsResult {
  [key: string]: string;
}

function parseTxtRecords(txtRecords: string[][]): TxtRecordsResult {
  const result: TxtRecordsResult = {};
  for (const recordArray of txtRecords) {
    const full = recordArray.join('');
    const eqIdx = full.indexOf('=');
    if (eqIdx === -1) {
      // No key=value format — use the whole string as key
      result[full] = '';
    } else {
      let key = full.substring(0, eqIdx);
      const value = full.substring(eqIdx + 1);
      // Handle duplicate keys by appending a suffix
      if (key in result) {
        let i = 2;
        while (`${key} (${i})` in result) i++;
        key = `${key} (${i})`;
      }
      result[key] = value;
    }
  }
  return result;
}

async function tryResolveTxt(hostname: string): Promise<string[][] | null> {
  try {
    return await dns.resolveTxt(hostname);
  } catch {
    return null;
  }
}

export const txtRecordsHandler: AnalysisHandler<TxtRecordsResult> = async (url, options) => {
  try {
    const hostname = extractHostname(url);

    // Try the exact hostname first
    let txtRecords = await tryResolveTxt(hostname);

    // If no TXT records and hostname is a subdomain, try the root domain
    if (!txtRecords) {
      const parsed = psl.parse(hostname);
      if ('listed' in parsed && parsed.domain && parsed.domain !== hostname) {
        txtRecords = await tryResolveTxt(parsed.domain);
      }
    }

    if (!txtRecords || txtRecords.length === 0) {
      return { data: {} as TxtRecordsResult };
    }

    return { data: parseTxtRecords(txtRecords) };
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ERR_INVALID_URL') {
      return { error: `Invalid URL ${err}`, errorCode: 'INVALID_URL', errorCategory: 'tool' };
    }
    return { error: err.message };
  }
};
