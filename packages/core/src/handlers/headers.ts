import axios from 'axios';
import type { AnalysisHandler, HandlerResult } from '../types.js';
import { getFinalResponseUrl } from '../utils/http.js';
import { normalizeUrl } from '../utils/url.js';

export interface HeadersResult {
  finalUrl?: string;
  [key: string]: string | string[] | undefined;
}

export const headersHandler: AnalysisHandler<HeadersResult> = async (url, options) => {
  try {
    const targetUrl = normalizeUrl(url);
    const response = await axios.get(targetUrl, {
      timeout: options?.timeout,
      validateStatus: (status: number) => status >= 200 && status < 600,
    });

    return {
      data: {
        ...(response.headers as HeadersResult),
        finalUrl: getFinalResponseUrl(response) ?? targetUrl,
      },
    };
  } catch (error) {
    return { error: (error as Error).message };
  }
};
