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
    const fullUrl = url.startsWith('http') ? url : `https://${url}`;
    const endpoint =
      `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?` +
      `url=${encodeURIComponent(fullUrl)}&category=PERFORMANCE&category=ACCESSIBILITY` +
      `&category=BEST-PRACTICES&category=SEO&strategy=mobile` +
      `&key=${apiKey}`;

    const response = await withRetry(
      () => axios.get(endpoint, { timeout: options?.timeout }),
    );
    return { data: response.data as QualityResult };
  } catch (error) {
    const axiosErr = error as any;
    if (axiosErr.response) {
      const status = axiosErr.response.status;
      const detail = axiosErr.response.data?.error;
      const msg = detail
        ? `${detail.message}${detail.status ? ` [${detail.status}]` : ''}${detail.errors?.length ? ` — ${detail.errors.map((e: any) => e.reason).join(', ')}` : ''}`
        : JSON.stringify(axiosErr.response.data);
      return { error: `PageSpeed API ${status}: ${msg}` };
    }
    return { error: (error as Error).message };
  }
};
