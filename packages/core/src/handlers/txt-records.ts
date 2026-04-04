import dns from 'dns/promises';
import type { AnalysisHandler, HandlerResult } from '../types.js';
import { extractHostname } from '../utils/url.js';

export interface TxtRecordsResult {
  [key: string]: string;
}

export const txtRecordsHandler: AnalysisHandler<TxtRecordsResult> = async (url, options) => {
  try {
    const hostname = extractHostname(url);
    const txtRecords = await dns.resolveTxt(hostname);

    // Parsing and formatting TXT records into a single object
    const readableTxtRecords: TxtRecordsResult = txtRecords.reduce(
      (acc: TxtRecordsResult, recordArray: string[]) => {
        const recordObject = recordArray.reduce(
          (recordAcc: TxtRecordsResult, recordString: string) => {
            const splitRecord = recordString.split('=');
            const key = splitRecord[0];
            const value = splitRecord.slice(1).join('=');
            return { ...recordAcc, [key]: value };
          },
          {},
        );
        return { ...acc, ...recordObject };
      },
      {},
    );

    return { data: readableTxtRecords };
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ERR_INVALID_URL') {
      return { error: `Invalid URL ${err}`, errorCode: 'INVALID_URL', errorCategory: 'tool' };
    }
    return { error: err.message };
  }
};
