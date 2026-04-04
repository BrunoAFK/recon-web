import axios from 'axios';
import type { AnalysisHandler, HandlerResult } from '../types.js';
import { extractHostname } from '../utils/url.js';

const MOZILLA_TLS_OBSERVATORY_API = 'https://tls-observatory.services.mozilla.com/api/v1';

export interface TlsResult {
  id?: number;
  timestamp?: string;
  target?: string;
  replay?: number;
  has_tls?: boolean;
  cert_id?: number;
  trust_id?: number;
  is_valid?: boolean;
  completion_perc?: number;
  connection_info?: Record<string, unknown>;
  analysis?: Record<string, unknown>[];
  [key: string]: unknown;
}

export const tlsHandler: AnalysisHandler<TlsResult> = async (url, options) => {
  try {
    const domain = extractHostname(url);
    const scanResponse = await axios.post(
      `${MOZILLA_TLS_OBSERVATORY_API}/scan?target=${domain}`,
    );
    const scanId = scanResponse.data.scan_id;

    if (typeof scanId !== 'number') {
      return { error: 'Failed to get scan_id from TLS Observatory', errorCode: 'NO_DATA', errorCategory: 'info' };
    }

    const resultResponse = await axios.get(
      `${MOZILLA_TLS_OBSERVATORY_API}/results?id=${scanId}`,
    );
    return { data: resultResponse.data as TlsResult };
  } catch (error) {
    return { error: (error as Error).message };
  }
};
