import type { AnalysisHandler, HandlerResult } from '../types.js';
import { normalizeUrl } from '../utils/url.js';
import { safeFetch } from '../utils/safe-fetch.js';
import { SsrfBlockedError } from '../utils/network.js';

interface RankEntry {
  date: string;
  rank: number;
}

export interface RankResult {
  ranks: RankEntry[];
  domain: string;
  message?: string;
}

export const rankHandler: AnalysisHandler<RankResult> = async (url, options) => {
  let domain: string;
  try {
    const targetUrl = normalizeUrl(url);
    domain = new URL(targetUrl).hostname;
  } catch {
    return { error: 'Invalid URL', errorCode: 'INVALID_URL', errorCategory: 'tool' };
  }

  if (!domain) {
    return { error: 'Invalid URL', errorCode: 'INVALID_URL', errorCategory: 'tool' };
  }

  try {
    const apiKey = options?.apiKeys?.TRANCO_API_KEY;
    const extraHeaders: Record<string, string> = {};
    if (apiKey) {
      const username = options?.apiKeys?.TRANCO_USERNAME ?? '';
      const credentials = Buffer.from(`${username}:${apiKey}`).toString('base64');
      extraHeaders['Authorization'] = `Basic ${credentials}`;
    }

    const response = await safeFetch(
      `https://tranco-list.eu/api/ranks/domain/${domain}`,
      { timeoutMs: options?.timeout ?? 5000, headers: extraHeaders },
    );

    if (!response.data || !response.data.ranks || response.data.ranks.length === 0) {
      return {
        data: {
          domain,
          ranks: [],
          message: `${domain} is not ranked in the Tranco top 100 million list.`,
        },
      };
    }

    return { data: response.data as RankResult };
  } catch (error) {
    if (error instanceof SsrfBlockedError) {
      return { error: 'Blocked: target resolves to private address' };
    }
    return { error: `Unable to fetch rank, ${(error as Error).message}` };
  }
};
