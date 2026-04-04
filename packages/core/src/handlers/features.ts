import https from 'https';
import type { AnalysisHandler, HandlerResult } from '../types.js';

export interface FeaturesResult {
  [key: string]: unknown;
}

export const featuresHandler: AnalysisHandler<FeaturesResult> = async (url, options) => {
  if (!url) {
    return { error: 'URL is required', errorCode: 'INVALID_URL', errorCategory: 'tool' };
  }

  const apiKey = options?.apiKeys?.BUILT_WITH_API_KEY;
  if (!apiKey) {
    return { error: 'Missing BuiltWith API key. Provide BUILT_WITH_API_KEY via options.apiKeys', errorCode: 'MISSING_API_KEY', errorCategory: 'tool' };
  }

  const apiUrl = `https://api.builtwith.com/free1/api.json?KEY=${apiKey}&LOOKUP=${encodeURIComponent(url)}`;

  try {
    const data = await new Promise<string>((resolve, reject) => {
      const req = https.get(apiUrl, (res) => {
        let body = '';

        res.on('data', (chunk: Buffer) => {
          body += chunk;
        });

        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode <= 299) {
            resolve(body);
          } else {
            reject(new Error(`Request failed with status code: ${res.statusCode}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.end();
    });

    const parsed = JSON.parse(data) as FeaturesResult;
    return { data: parsed };
  } catch (error) {
    return { error: `Error making request: ${(error as Error).message}` };
  }
};
