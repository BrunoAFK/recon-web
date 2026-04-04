import axios from 'axios';
import type { AnalysisHandler, HandlerResult } from '../types.js';
import { normalizeUrl } from '../utils/url.js';

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
    const authConfig = apiKey
      ? { auth: { username: options?.apiKeys?.TRANCO_USERNAME ?? '', password: apiKey } }
      : {};

    const response = await axios.get(
      `https://tranco-list.eu/api/ranks/domain/${domain}`,
      { timeout: options?.timeout ?? 5000, ...authConfig },
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
    return { error: `Unable to fetch rank, ${(error as Error).message}` };
  }
};
