import * as xml2js from 'xml2js';
import type { AnalysisHandler } from '../types.js';
import { normalizeUrl } from '../utils/url.js';
import { safeFetch } from '../utils/safe-fetch.js';
import { SsrfBlockedError } from '../utils/network.js';

export interface SitemapResult {
  sitemapUrl: string;
  source: 'direct' | 'robots.txt';
  type: 'urlset' | 'sitemapindex' | 'unknown';
  urls: string[];
  message?: string;
  [key: string]: unknown;
}

/**
 * Extract all sitemap URLs from robots.txt content.
 */
function extractSitemapUrlsFromRobots(robotsTxt: string): string[] {
  const urls: string[] = [];
  for (const line of robotsTxt.split('\n')) {
    const match = line.match(/^\s*sitemap\s*:\s*(.+)/i);
    if (match) urls.push(match[1].trim());
  }
  return urls;
}

/**
 * Recursively find all <loc> values in parsed XML, case-insensitive.
 */
function extractLocs(obj: unknown): string[] {
  if (obj == null) return [];
  if (typeof obj === 'string') return [];
  if (Array.isArray(obj)) return obj.flatMap(extractLocs);

  const record = obj as Record<string, unknown>;
  const locs: string[] = [];

  for (const [key, value] of Object.entries(record)) {
    if (key.toLowerCase() === 'loc') {
      if (Array.isArray(value)) {
        for (const v of value) {
          if (typeof v === 'string') locs.push(v);
        }
      } else if (typeof value === 'string') {
        locs.push(value);
      }
    } else if (typeof value === 'object' && value !== null) {
      locs.push(...extractLocs(value));
    }
  }
  return locs;
}

/**
 * Detect sitemap type from parsed XML root keys (case-insensitive).
 */
function detectType(parsed: Record<string, unknown>): 'urlset' | 'sitemapindex' | 'unknown' {
  const rootKey = Object.keys(parsed).find(
    (k) => k !== '$' && k !== '_',
  );
  if (!rootKey) return 'unknown';
  const lower = rootKey.toLowerCase();
  if (lower === 'urlset') return 'urlset';
  if (lower === 'sitemapindex') return 'sitemapindex';
  return 'unknown';
}

export const sitemapHandler: AnalysisHandler<SitemapResult> = async (url, options) => {
  const targetUrl = normalizeUrl(url);
  const timeout = options?.timeout ?? 10_000;
  const fetchOpts = { timeoutMs: timeout, maxRedirects: 5 };

  // Strategy: try robots.txt first (it often has the canonical sitemap URL),
  // then fall back to common sitemap paths.
  const candidates: { url: string; source: 'robots.txt' | 'direct' }[] = [];

  // 1. Try robots.txt for sitemap directives
  try {
    const robotsRes = await safeFetch(`${targetUrl}/robots.txt`, fetchOpts);
    if (typeof robotsRes.data === 'string') {
      const robotsSitemaps = extractSitemapUrlsFromRobots(robotsRes.data);
      for (const s of robotsSitemaps) {
        candidates.push({ url: s, source: 'robots.txt' });
      }
    }
  } catch (err) {
    if (err instanceof SsrfBlockedError) {
      return { error: 'Blocked: target resolves to private address' };
    }
    // robots.txt not available — that's fine
  }

  // 2. Add common paths as fallback (only if not already in candidates)
  const commonPaths = [`${targetUrl}/sitemap.xml`, `${targetUrl}/sitemap_index.xml`];
  for (const p of commonPaths) {
    if (!candidates.some((c) => c.url === p)) {
      candidates.push({ url: p, source: 'direct' });
    }
  }

  // 3. Try each candidate until one works
  for (const candidate of candidates) {
    try {
      const res = await safeFetch(candidate.url, fetchOpts);
      if (res.status !== 200 || typeof res.data !== 'string') continue;

      // Must look like XML
      const trimmed = res.data.trim();
      if (!trimmed.startsWith('<?xml') && !trimmed.startsWith('<')) continue;

      const parser = new xml2js.Parser({ strict: false, normalizeTags: true });
      let parsed: Record<string, unknown>;
      try {
        parsed = await parser.parseStringPromise(res.data);
      } catch {
        continue; // Malformed XML — try next candidate
      }

      const type = detectType(parsed);
      const urls = extractLocs(parsed);

      return {
        data: {
          sitemapUrl: candidate.url,
          source: candidate.source,
          type,
          urls,
        },
      };
    } catch (err) {
      if (err instanceof SsrfBlockedError) {
        return { error: 'Blocked: target resolves to private address' };
      }
      continue; // Network error — try next candidate
    }
  }

  return { data: { sitemapUrl: '', source: 'direct', type: 'unknown', urls: [], message: 'No sitemap was found for this site.' } };
};
