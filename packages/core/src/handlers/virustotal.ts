import type { AnalysisHandler } from '../types.js';
import { normalizeUrl } from '../utils/url.js';

export interface VirusTotalStats {
  harmless: number;
  malicious: number;
  suspicious: number;
  undetected: number;
  timeout: number;
}

export interface VirusTotalResult {
  url: string;
  stats: VirusTotalStats;
  totalEngines: number;
  positives: number;
  scanDate: string | null;
  permalink: string | null;
}

interface VtAnalysisAttributes {
  stats?: VirusTotalStats;
  date?: number;
  [key: string]: unknown;
}

interface VtUrlAttributes {
  last_analysis_stats?: VirusTotalStats;
  last_analysis_date?: number;
  last_http_response_content_length?: number;
  url?: string;
  [key: string]: unknown;
}

export const virusTotalHandler: AnalysisHandler<VirusTotalResult> = async (url, options) => {
  const apiKey = options?.apiKeys?.VIRUSTOTAL_API_KEY;
  if (!apiKey) {
    return {
      skipped: 'VIRUSTOTAL_API_KEY not configured. Get a free key at https://www.virustotal.com/gui/join',
      errorCode: 'MISSING_API_KEY',
      errorCategory: 'tool',
    };
  }

  try {
    const normalized = normalizeUrl(url);
    const timeout = options?.timeout ?? 15_000;
    const headers = { 'x-apikey': apiKey };

    // Step 1: Submit URL for scanning
    const submitRes = await fetch('https://www.virustotal.com/api/v3/urls', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `url=${encodeURIComponent(normalized)}`,
      signal: AbortSignal.timeout(timeout),
    });

    if (submitRes.status === 429) {
      return { error: 'VirusTotal rate limit exceeded (4 req/min on free tier)', errorCategory: 'tool' };
    }

    if (!submitRes.ok) {
      return { error: `VirusTotal submit failed: ${submitRes.status}` };
    }

    const submitData = await submitRes.json() as { data?: { id?: string } };
    const analysisId = submitData.data?.id;

    if (!analysisId) {
      return { error: 'VirusTotal returned no analysis ID' };
    }

    // Step 2: Poll for results (max 3 attempts, 3s apart)
    let stats: VirusTotalStats | null = null;
    let scanDate: number | null = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 3_000));

      const analysisRes = await fetch(
        `https://www.virustotal.com/api/v3/analyses/${analysisId}`,
        { headers, signal: AbortSignal.timeout(timeout) },
      );

      if (analysisRes.status === 429) {
        return { error: 'VirusTotal rate limit exceeded', errorCategory: 'tool' };
      }

      if (!analysisRes.ok) continue;

      const analysisData = await analysisRes.json() as {
        data?: { attributes?: VtAnalysisAttributes };
      };
      const attrs = analysisData.data?.attributes;

      if (attrs?.stats) {
        stats = attrs.stats;
        scanDate = attrs.date ?? null;
        break;
      }
    }

    // Fallback: try the URL report endpoint (uses cached results)
    if (!stats) {
      const urlId = Buffer.from(normalized).toString('base64url');
      const reportRes = await fetch(
        `https://www.virustotal.com/api/v3/urls/${urlId}`,
        { headers, signal: AbortSignal.timeout(timeout) },
      );

      if (reportRes.ok) {
        const reportData = await reportRes.json() as {
          data?: { attributes?: VtUrlAttributes };
        };
        const attrs = reportData.data?.attributes;
        if (attrs?.last_analysis_stats) {
          stats = attrs.last_analysis_stats;
          scanDate = attrs.last_analysis_date ?? null;
        }
      }
    }

    if (!stats) {
      return { error: 'VirusTotal analysis did not complete in time' };
    }

    const totalEngines = stats.harmless + stats.malicious + stats.suspicious + stats.undetected + stats.timeout;
    const positives = stats.malicious + stats.suspicious;

    return {
      data: {
        url: normalized,
        stats,
        totalEngines,
        positives,
        scanDate: scanDate ? new Date(scanDate * 1000).toISOString() : null,
        permalink: `https://www.virustotal.com/gui/url/${Buffer.from(normalized).toString('base64url')}`,
      },
    };
  } catch (error) {
    return { error: (error as Error).message };
  }
};
