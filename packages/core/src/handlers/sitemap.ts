import axios from 'axios';
import * as xml2js from 'xml2js';
import type { AnalysisHandler, HandlerResult } from '../types.js';
import { normalizeUrl } from '../utils/url.js';

export interface SitemapResult {
  urls?: string[];
  message?: string;
  [key: string]: unknown;
}

export const sitemapHandler: AnalysisHandler<SitemapResult> = async (url, options) => {
  const targetUrl = normalizeUrl(url);
  let sitemapUrl = `${targetUrl}/sitemap.xml`;
  const hardTimeOut = options?.timeout ?? 5000;

  try {
    let sitemapRes;
    try {
      sitemapRes = await axios.get(sitemapUrl, { timeout: hardTimeOut });
    } catch (error) {
      const axiosError = error as any;
      if (axiosError.response && axiosError.response.status === 404) {
        // Try to fetch sitemap URL from robots.txt
        const robotsRes = await axios.get(`${targetUrl}/robots.txt`, { timeout: hardTimeOut });
        const robotsTxt: string[] = robotsRes.data.split('\n');
        let foundSitemapUrl = '';

        for (const line of robotsTxt) {
          if (line.toLowerCase().startsWith('sitemap:')) {
            foundSitemapUrl = line.split(' ')[1].trim();
            break;
          }
        }

        if (!foundSitemapUrl) {
          return { data: { urls: [], message: 'No sitemap was found for this site.' } };
        }

        sitemapUrl = foundSitemapUrl;
        sitemapRes = await axios.get(sitemapUrl, { timeout: hardTimeOut });
      } else {
        throw error;
      }
    }

    const parser = new xml2js.Parser();
    const sitemap = await parser.parseStringPromise(sitemapRes.data);

    return { data: sitemap as SitemapResult };
  } catch (error) {
    const err = error as any;
    if (err.code === 'ECONNABORTED') {
      return { error: `Request timed-out after ${hardTimeOut}ms`, errorCode: 'TIMEOUT', errorCategory: 'site' };
    }
    return { error: (error as Error).message };
  }
};
