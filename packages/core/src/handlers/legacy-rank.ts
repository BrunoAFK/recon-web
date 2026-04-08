import axios from 'axios';
import * as unzipper from 'unzipper';
import csv from 'csv-parser';
import fs from 'fs';
import type { AnalysisHandler, HandlerResult } from '../types.js';
import { normalizeUrl } from '../utils/url.js';

const FILE_URL = 'https://s3-us-west-1.amazonaws.com/umbrella-static/top-1m.csv.zip';
const TEMP_FILE_PATH = '/tmp/top-1m.csv';

export interface LegacyRankResult {
  domain: string;
  rank: string;
  isFound: boolean;
  message?: string;
}

export const legacyRankHandler: AnalysisHandler<LegacyRankResult> = async (url, options) => {
  let domain: string;
  try {
    const targetUrl = normalizeUrl(url);
    domain = new URL(targetUrl).hostname;
  } catch {
    return { error: 'Invalid URL', errorCode: 'INVALID_URL', errorCategory: 'tool' };
  }

  try {
    // Download and unzip the file if not in cache
    if (!fs.existsSync(TEMP_FILE_PATH)) {
      const response = await axios({
        method: 'GET',
        url: FILE_URL,
        responseType: 'stream',
        timeout: options?.timeout,
      });

      await new Promise<void>((resolve, reject) => {
        (response.data as NodeJS.ReadableStream)
          .pipe(unzipper.Extract({ path: '/tmp' }))
          .on('close', resolve)
          .on('error', reject);
      });
    }

    // Parse the CSV and find the rank
    return new Promise<HandlerResult<LegacyRankResult>>((resolve, reject) => {
      const csvStream = fs
        .createReadStream(TEMP_FILE_PATH)
        .pipe(csv({ headers: ['rank', 'domain'] }))
        .on('data', (row: { rank: string; domain: string }) => {
          if (row.domain === domain) {
            csvStream.destroy();
            resolve({
              data: {
                domain,
                rank: row.rank,
                isFound: true,
              },
            });
          }
        })
        .on('end', () => {
          resolve({
            data: {
              domain,
              rank: '',
              isFound: false,
              message: `${domain} is not present in the Umbrella top 1M list.`,
            },
          });
        })
        .on('error', reject);
    });
  } catch (error) {
    return { error: (error as Error).message };
  }
};
