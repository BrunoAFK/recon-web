import type { AnalysisHandler, HandlerResult } from '../types.js';
import { normalizeUrl } from '../utils/url.js';
import { safeFetch } from '../utils/safe-fetch.js';
import { SsrfBlockedError } from '../utils/network.js';

export interface HttpSecurityResult {
  finalUrl?: string;
  strictTransportPolicy: boolean;
  xFrameOptions: boolean;
  xContentTypeOptions: boolean;
  xXSSProtection: boolean;
  contentSecurityPolicy: boolean;
}

export const httpSecurityHandler: AnalysisHandler<HttpSecurityResult> = async (url, options) => {
  try {
    const fullUrl = normalizeUrl(url);
    const response = await safeFetch(fullUrl, { timeoutMs: options?.timeout });
    const headers = response.headers;

    const result: HttpSecurityResult = {
      // Note: finalUrl is the initial (normalized) URL; post-redirect URL is not tracked
      finalUrl: fullUrl,
      strictTransportPolicy: !!headers['strict-transport-security'],
      xFrameOptions: !!headers['x-frame-options'],
      xContentTypeOptions: !!headers['x-content-type-options'],
      xXSSProtection: !!headers['x-xss-protection'],
      contentSecurityPolicy: !!headers['content-security-policy'],
    };

    return { data: result };
  } catch (error) {
    if (error instanceof SsrfBlockedError) {
      return { error: 'Blocked: target resolves to private address' };
    }
    return { error: (error as Error).message };
  }
};
