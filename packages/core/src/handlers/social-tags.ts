import axios from 'axios';
import * as cheerio from 'cheerio';
import type { AnalysisHandler, HandlerResult } from '../types.js';
import { getFinalResponseUrl } from '../utils/http.js';
import { normalizeUrl } from '../utils/url.js';

export interface SocialTagsResult {
  title: string;
  message?: string;
  finalUrl?: string;
  description?: string;
  keywords?: string;
  canonicalUrl?: string;
  ogTitle?: string;
  ogType?: string;
  ogImage?: string;
  ogUrl?: string;
  ogDescription?: string;
  ogSiteName?: string;
  twitterCard?: string;
  twitterSite?: string;
  twitterCreator?: string;
  twitterTitle?: string;
  twitterDescription?: string;
  twitterImage?: string;
  themeColor?: string;
  robots?: string;
  googlebot?: string;
  generator?: string;
  viewport?: string;
  author?: string;
  publisher?: string;
  favicon?: string;
}

export const socialTagsHandler: AnalysisHandler<SocialTagsResult> = async (url, options) => {
  const targetUrl = normalizeUrl(url);

  try {
    const response = await axios.get(targetUrl, { timeout: options?.timeout });
    const finalUrl = getFinalResponseUrl(response) ?? targetUrl;
    const html: string = response.data;
    const $ = cheerio.load(html);

    const metadata: SocialTagsResult = {
      title: $('head title').text(),
      finalUrl,
      description: $('meta[name="description"]').attr('content'),
      keywords: $('meta[name="keywords"]').attr('content'),
      canonicalUrl: $('link[rel="canonical"]').attr('href'),

      ogTitle: $('meta[property="og:title"]').attr('content'),
      ogType: $('meta[property="og:type"]').attr('content'),
      ogImage: $('meta[property="og:image"]').attr('content'),
      ogUrl: $('meta[property="og:url"]').attr('content'),
      ogDescription: $('meta[property="og:description"]').attr('content'),
      ogSiteName: $('meta[property="og:site_name"]').attr('content'),

      twitterCard: $('meta[name="twitter:card"]').attr('content'),
      twitterSite: $('meta[name="twitter:site"]').attr('content'),
      twitterCreator: $('meta[name="twitter:creator"]').attr('content'),
      twitterTitle: $('meta[name="twitter:title"]').attr('content'),
      twitterDescription: $('meta[name="twitter:description"]').attr('content'),
      twitterImage: $('meta[name="twitter:image"]').attr('content'),

      themeColor: $('meta[name="theme-color"]').attr('content'),
      robots: $('meta[name="robots"]').attr('content'),
      googlebot: $('meta[name="googlebot"]').attr('content'),
      generator: $('meta[name="generator"]').attr('content'),
      viewport: $('meta[name="viewport"]').attr('content'),
      author: $('meta[name="author"]').attr('content'),
      publisher: $('link[rel="publisher"]').attr('href'),
      favicon: $('link[rel="icon"]').attr('href'),
    };

    const hasAnyValue = Object.values(metadata).some((v) => v !== undefined && v !== '');
    if (!hasAnyValue) {
      return { data: { title: '', finalUrl, message: 'No social or meta tags were detected on the page.' } };
    }

    return { data: metadata };
  } catch (error) {
    return { error: `Failed fetching data: ${(error as Error).message}` };
  }
};
