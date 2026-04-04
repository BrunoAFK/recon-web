import axios from 'axios';
import type { AnalysisHandler, HandlerResult } from '../types.js';
import { getFinalResponseUrl } from '../utils/http.js';
import { normalizeUrl } from '../utils/url.js';

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
  let finalUrl: string | undefined;

  try {
    const response = await axios.get(targetUrl, {
      withCredentials: true,
      maxRedirects: 5,
      timeout: options?.timeout,
    });
    headerCookies = (response.headers['set-cookie'] as string[] | undefined) ?? null;
    finalUrl = getFinalResponseUrl(response) ?? targetUrl;
  } catch (error) {
    const axiosError = error as any;
    if (axiosError.response) {
      return { error: `Request failed with status ${axiosError.response.status}: ${axiosError.message}` };
    } else if (axiosError.request) {
      return { error: `No response received: ${axiosError.message}` };
    } else {
      return { error: `Error setting up request: ${(error as Error).message}` };
    }
  }

  // Client-side cookies require puppeteer, which is not available in core.
  // Only header cookies are extracted here.
  const clientCookies: CookieEntry[] | null = null as CookieEntry[] | null;

  if (!headerCookies && (!clientCookies || clientCookies.length === 0)) {
    return { data: { headerCookies, clientCookies, finalUrl, message: 'No cookies were detected in the server response.' } };
  }

  return { data: { headerCookies, clientCookies, finalUrl } };
};
