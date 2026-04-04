import * as cheerio from 'cheerio';
import type { AnalysisHandler } from '../types.js';
import { normalizeUrl } from '../utils/url.js';

export interface SeoIssue {
  severity: 'error' | 'warning' | 'info';
  message: string;
}

export interface HeadingInfo {
  tag: string;
  count: number;
}

export interface ImageInfo {
  total: number;
  withoutAlt: number;
  withAlt: number;
}

export interface StructuredDataItem {
  type: string;
  name?: string;
}

export interface SeoResult {
  score: number;
  title: string | null;
  titleLength: number;
  metaDescription: string | null;
  metaDescriptionLength: number;
  canonical: string | null;
  canonicalIsSelf: boolean;
  viewport: string | null;
  language: string | null;
  headings: HeadingInfo[];
  h1Count: number;
  h1Text: string | null;
  images: ImageInfo;
  wordCount: number;
  textRatio: number;
  structuredData: StructuredDataItem[];
  hreflang: string[];
  metaRobots: string | null;
  issues: SeoIssue[];
}

export const seoHandler: AnalysisHandler<SeoResult> = async (url, options) => {
  try {
    const normalized = normalizeUrl(url);
    const timeout = options?.timeout ?? 15_000;

    const res = await fetch(normalized, {
      redirect: 'follow',
      signal: AbortSignal.timeout(timeout),
      headers: { 'User-Agent': 'recon-web/1.0 (SEO audit)' },
    });

    if (!res.ok) {
      return { error: `HTTP ${res.status} — cannot audit a non-200 page` };
    }

    const html = await res.text();
    const $ = cheerio.load(html);
    const issues: SeoIssue[] = [];

    // ── Title ──────────────────────────────────────────
    const title = $('title').first().text().trim() || null;
    const titleLength = title?.length ?? 0;

    if (!title) {
      issues.push({ severity: 'error', message: 'Missing <title> tag.' });
    } else if (titleLength < 30) {
      issues.push({ severity: 'warning', message: `Title is too short (${titleLength} chars). Aim for 50-60.` });
    } else if (titleLength > 60) {
      issues.push({ severity: 'warning', message: `Title is too long (${titleLength} chars). May be truncated in search results.` });
    }

    // ── Meta Description ───────────────────────────────
    const metaDescription = $('meta[name="description"]').attr('content')?.trim() || null;
    const metaDescriptionLength = metaDescription?.length ?? 0;

    if (!metaDescription) {
      issues.push({ severity: 'warning', message: 'Missing meta description.' });
    } else if (metaDescriptionLength < 70) {
      issues.push({ severity: 'info', message: `Meta description is short (${metaDescriptionLength} chars). Aim for 150-160.` });
    } else if (metaDescriptionLength > 160) {
      issues.push({ severity: 'info', message: `Meta description is long (${metaDescriptionLength} chars). May be truncated.` });
    }

    // ── Canonical ──────────────────────────────────────
    const canonical = $('link[rel="canonical"]').attr('href')?.trim() || null;
    const canonicalIsSelf = canonical ? canonical === normalized || canonical === res.url : false;

    if (!canonical) {
      issues.push({ severity: 'warning', message: 'No canonical URL defined.' });
    }

    // ── Viewport ───────────────────────────────────────
    const viewport = $('meta[name="viewport"]').attr('content')?.trim() || null;

    if (!viewport) {
      issues.push({ severity: 'error', message: 'Missing viewport meta tag. Page may not be mobile-friendly.' });
    }

    // ── Language ───────────────────────────────────────
    const language = $('html').attr('lang')?.trim() || null;

    if (!language) {
      issues.push({ severity: 'info', message: 'No lang attribute on <html>. Helps search engines understand content language.' });
    }

    // ── Headings ───────────────────────────────────────
    const headings: HeadingInfo[] = [];
    for (const tag of ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']) {
      const count = $(tag).length;
      if (count > 0) headings.push({ tag, count });
    }

    const h1Count = $('h1').length;
    const h1Text = $('h1').first().text().trim() || null;

    if (h1Count === 0) {
      issues.push({ severity: 'error', message: 'No <h1> tag found.' });
    } else if (h1Count > 1) {
      issues.push({ severity: 'warning', message: `Multiple <h1> tags (${h1Count}). Use only one per page.` });
    }

    // ── Images ─────────────────────────────────────────
    const allImages = $('img');
    const totalImages = allImages.length;
    let withoutAlt = 0;
    allImages.each((_, el) => {
      const alt = $(el).attr('alt');
      if (alt === undefined || alt === '') withoutAlt++;
    });

    if (withoutAlt > 0) {
      issues.push({
        severity: 'warning',
        message: `${withoutAlt} of ${totalImages} image${totalImages > 1 ? 's' : ''} missing alt text.`,
      });
    }

    // ── Word Count & Text Ratio ────────────────────────
    const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
    const wordCount = bodyText ? bodyText.split(/\s+/).length : 0;
    const textRatio = html.length > 0 ? Math.round((bodyText.length / html.length) * 100) : 0;

    if (wordCount < 300) {
      issues.push({ severity: 'info', message: `Low word count (${wordCount}). Pages with more content tend to rank better.` });
    }

    // ── Structured Data ────────────────────────────────
    const structuredData: StructuredDataItem[] = [];

    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const json = JSON.parse($(el).html() || '');
        const items = Array.isArray(json) ? json : [json];
        for (const item of items) {
          if (item['@type']) {
            structuredData.push({
              type: item['@type'],
              name: item.name || item.headline || undefined,
            });
          }
        }
      } catch {
        // Invalid JSON-LD
      }
    });

    // ── Hreflang ───────────────────────────────────────
    const hreflang: string[] = [];
    $('link[rel="alternate"][hreflang]').each((_, el) => {
      const lang = $(el).attr('hreflang');
      if (lang) hreflang.push(lang);
    });

    // ── Meta Robots ────────────────────────────────────
    const metaRobots = $('meta[name="robots"]').attr('content')?.trim() || null;

    if (metaRobots?.includes('noindex')) {
      issues.push({ severity: 'warning', message: 'Page is set to noindex — it will not appear in search results.' });
    }

    // ── Score Calculation ──────────────────────────────
    let score = 100;
    for (const issue of issues) {
      if (issue.severity === 'error') score -= 15;
      else if (issue.severity === 'warning') score -= 8;
      else score -= 3;
    }
    score = Math.max(0, Math.min(100, score));

    return {
      data: {
        score,
        title,
        titleLength,
        metaDescription,
        metaDescriptionLength,
        canonical,
        canonicalIsSelf,
        viewport,
        language,
        headings,
        h1Count,
        h1Text,
        images: { total: totalImages, withoutAlt, withAlt: totalImages - withoutAlt },
        wordCount,
        textRatio,
        structuredData,
        hreflang,
        metaRobots,
        issues,
      },
    };
  } catch (error) {
    return { error: (error as Error).message };
  }
};
