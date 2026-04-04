import got from 'got';
import type { AnalysisHandler, HandlerResult } from '../types.js';
import { normalizeUrl } from '../utils/url.js';

export interface RedirectsResult {
  redirects: string[];
}

export const redirectsHandler: AnalysisHandler<RedirectsResult> = async (url, options) => {
  const targetUrl = normalizeUrl(url);
  const redirects: string[] = [targetUrl];

  try {
    await got(targetUrl, {
      followRedirect: true,
      maxRedirects: 12,
      timeout: options?.timeout ? { request: options.timeout } : undefined,
      hooks: {
        beforeRedirect: [
          (_updatedOptions: unknown, response: any) => {
            const location = response.headers?.location;
            if (location) {
              redirects.push(location);
            }
          },
        ],
      },
    });

    return { data: { redirects } };
  } catch (error) {
    return { error: (error as Error).message };
  }
};
