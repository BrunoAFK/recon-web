import type { AnalysisHandler, HandlerResult } from '../types.js';
import { withRetry } from '../utils/retry.js';
import { safeFetch } from '../utils/safe-fetch.js';
import { SsrfBlockedError } from '../utils/network.js';

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
      () => safeFetch(endpoint, { timeoutMs: options?.timeout }),
    );

    if (response.status >= 400) {
      const detail = response.data?.error;
      const msg = detail
        ? `${detail.message}${detail.status ? ` [${detail.status}]` : ''}${detail.errors?.length ? ` — ${detail.errors.map((e: any) => e.reason).join(', ')}` : ''}`
        : JSON.stringify(response.data);
      return { error: `PageSpeed API ${response.status}: ${msg}` };
    }

    return { data: response.data as QualityResult };
  } catch (error) {
    if (error instanceof SsrfBlockedError) {
      return { error: 'Blocked: target resolves to private address' };
    }
    return { error: (error as Error).message };
  }
};
