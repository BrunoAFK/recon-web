import type { AnalysisHandler, HandlerResult } from '../types.js';
import { normalizeUrl } from '../utils/url.js';
import { safeFetch } from '../utils/safe-fetch.js';
import { SsrfBlockedError } from '../utils/network.js';

export interface HeadersResult {
  finalUrl?: string;
  [key: string]: string | string[] | undefined;
}

export const headersHandler: AnalysisHandler<HeadersResult> = async (url, options) => {
  try {
    const targetUrl = normalizeUrl(url);
    const response = await safeFetch(targetUrl, { timeoutMs: options?.timeout });

    return {
      data: {
        ...(response.headers as HeadersResult),
        // Note: finalUrl is the initial (normalized) URL; post-redirect URL is not tracked
        // because safeFetch handles redirects internally without exposing the final URL.
        finalUrl: targetUrl,
      },
    };
  } catch (error) {
    if (error instanceof SsrfBlockedError) {
      return { error: 'Blocked: target resolves to private address' };
    }
    return { error: (error as Error).message };
  }
};
