import axios from 'axios';
import type { AnalysisHandler, HandlerResult } from '../types.js';
import { withRetry } from '../utils/retry.js';

export interface QualityResult {
  [key: string]: unknown;
}

export const qualityHandler: AnalysisHandler<QualityResult> = async (url, options) => {
  const apiKey = options?.apiKeys?.GOOGLE_CLOUD_API_KEY;

  if (!apiKey) {
    return {
      skipped: 'This check is unavailable in the current runtime or configuration. Missing GOOGLE_CLOUD_API_KEY.',
    };
  }

  try {
    const endpoint =
      `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?` +
      `url=${encodeURIComponent(url)}&category=PERFORMANCE&category=ACCESSIBILITY` +
      `&category=BEST_PRACTICES&category=SEO&category=PWA&strategy=mobile` +
      `&key=${apiKey}`;

    const response = await withRetry(
      () => axios.get(endpoint, { timeout: options?.timeout }),
    );
    return { data: response.data as QualityResult };
  } catch (error) {
    return { error: (error as Error).message };
  }
};
