import type { AnalysisHandler, HandlerResult } from '../types.js';
import { normalizeUrl } from '../utils/url.js';
import { safeFetch } from '../utils/safe-fetch.js';
import { SsrfBlockedError } from '../utils/network.js';

interface CookieEntry {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: string;
  [key: string]: unknown;
}

export interface CookiesResult {
  headerCookies: string[] | null;
  clientCookies: CookieEntry[] | null;
  message?: string;
  finalUrl?: string;
}

export const cookiesHandler: AnalysisHandler<CookiesResult> = async (url, options) => {
  const targetUrl = normalizeUrl(url);
  let headerCookies: string[] | null = null;

  try {
    const response = await safeFetch(targetUrl, {
      timeoutMs: options?.timeout,
      maxRedirects: 5,
    });
    headerCookies = (response.headers['set-cookie'] as string[] | undefined) ?? null;
  } catch (error) {
    if (error instanceof SsrfBlockedError) {
      return { error: 'Blocked: target resolves to private address' };
    }
    return { error: `Error setting up request: ${(error as Error).message}` };
  }

  // Client-side cookies require puppeteer, which is not available in core.
  // Only header cookies are extracted here.
  const clientCookies: CookieEntry[] | null = null as CookieEntry[] | null;

  if (!headerCookies && (!clientCookies || clientCookies.length === 0)) {
    return { data: { headerCookies, clientCookies, finalUrl: targetUrl, message: 'No cookies were detected in the server response.' } };
  }

  return { data: { headerCookies, clientCookies, finalUrl: targetUrl } };
};
