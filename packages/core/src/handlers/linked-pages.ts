import axios from 'axios';
import * as cheerio from 'cheerio';
import type { AnalysisHandler, HandlerResult } from '../types.js';
import { normalizeUrl } from '../utils/url.js';
import { getFinalResponseUrl } from '../utils/http.js';

export interface LinkedPagesResult {
  internal: string[];
  external: string[];
  message?: string;
  finalUrl?: string;
}

export const linkedPagesHandler: AnalysisHandler<LinkedPagesResult> = async (url, options) => {
  try {
    const targetUrl = normalizeUrl(url);
    const response = await axios.get(targetUrl, { timeout: options?.timeout });
    const finalUrl = getFinalResponseUrl(response) ?? targetUrl;
    const finalOrigin = new URL(finalUrl).origin;
    const html: string = response.data;
    const $ = cheerio.load(html);
    const internalLinksMap = new Map<string, number>();
    const externalLinksMap = new Map<string, number>();

    $('a[href]').each((_i: number, link: any) => {
      const href = $(link).attr('href');
      if (!href) return;
      const absoluteUrl = new URL(href, finalUrl).toString();
      const absoluteOrigin = new URL(absoluteUrl).origin;

      if (absoluteOrigin === finalOrigin) {
        internalLinksMap.set(absoluteUrl, (internalLinksMap.get(absoluteUrl) || 0) + 1);
      } else if (absoluteUrl.startsWith('http://') || absoluteUrl.startsWith('https://')) {
        externalLinksMap.set(absoluteUrl, (externalLinksMap.get(absoluteUrl) || 0) + 1);
      }
    });

    const internal = [...internalLinksMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .map((entry) => entry[0]);
    const external = [...externalLinksMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .map((entry) => entry[0]);

    if (internal.length === 0 && external.length === 0) {
      return {
        data: {
          internal,
          external,
          finalUrl,
          message:
            'No internal or external links were found in the returned HTML. This often means the page is heavily client-rendered and the static response did not contain link markup.',
        },
      };
    }

    return { data: { internal, external, finalUrl } };
  } catch (error) {
    return { error: (error as Error).message };
  }
};
