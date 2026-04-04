import https from 'https';
import type { AnalysisHandler, HandlerResult } from '../types.js';
import { normalizeUrl } from '../utils/url.js';

interface CarbonStatistics {
  adjustedBytes: number;
  energy: number;
  co2: {
    grid: { grams: number; litres: number };
    renewable: { grams: number; litres: number };
  };
}

export interface CarbonResult {
  scanUrl: string;
  statistics: CarbonStatistics;
  cleanerThan: number;
  green: boolean;
  message?: string;
}

const getHtmlSize = (url: string): Promise<number> =>
  new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let data = '';
        res.on('data', (chunk: Buffer) => {
          data += chunk;
        });
        res.on('end', () => {
          resolve(Buffer.byteLength(data, 'utf8'));
        });
      })
      .on('error', reject);
  });

const fetchCarbonData = (apiUrl: string): Promise<Record<string, unknown>> =>
  new Promise((resolve, reject) => {
    https
      .get(apiUrl, (res) => {
        let data = '';
        res.on('data', (chunk: Buffer) => {
          data += chunk;
        });
        res.on('end', () => {
          const trimmedData = data.trim();
          if (
            trimmedData.startsWith('<!DOCTYPE') ||
            trimmedData.startsWith('<html') ||
            trimmedData.startsWith('<')
          ) {
            reject(
              new Error(
                'WebsiteCarbon API returned HTML instead of JSON. This may be due to Cloudflare protection when running from a datacenter IP.',
              ),
            );
            return;
          }
          try {
            resolve(JSON.parse(data));
          } catch (parseError) {
            reject(new Error(`Failed to parse WebsiteCarbon API response as JSON: ${(parseError as Error).message}`));
          }
        });
      })
      .on('error', reject);
  });

export const carbonHandler: AnalysisHandler<CarbonResult> = async (url, options) => {
  try {
    const normalized = normalizeUrl(url);
    const sizeInBytes = await getHtmlSize(normalized);
    const apiUrl = `https://api.websitecarbon.com/data?bytes=${sizeInBytes}&green=0`;

    const carbonData = await fetchCarbonData(apiUrl);

    const stats = carbonData.statistics as CarbonStatistics | undefined;
    if (!stats || (stats.adjustedBytes === 0 && stats.energy === 0)) {
      return {
        data: {
          scanUrl: normalized,
          statistics: (stats ??
            ({
              adjustedBytes: 0,
              energy: 0,
              co2: {
                grid: { grams: 0, litres: 0 },
                renewable: { grams: 0, litres: 0 },
              },
            } as CarbonStatistics)),
          cleanerThan: 0,
          green: false,
          message: 'Not enough data was available to estimate carbon impact.',
        },
      };
    }

    const result: CarbonResult = {
      scanUrl: normalized,
      statistics: stats,
      cleanerThan: carbonData.cleanerThan as number,
      green: carbonData.green as boolean,
    };

    return { data: result };
  } catch (error) {
    return { error: (error as Error).message };
  }
};
