import type { AnalysisHandler } from '../types.js';
import { extractHostname } from '../utils/url.js';

export interface SslLabsEndpoint {
  ipAddress: string;
  grade: string;
  gradeTrustIgnored: string;
  hasWarnings: boolean;
  isExceptional: boolean;
  delegation: number;
}

export interface SslLabsResult {
  host: string;
  port: number;
  protocol: string;
  status: string;
  grade: string | null;
  gradeTrustIgnored: string | null;
  hasWarnings: boolean;
  endpoints: SslLabsEndpoint[];
  testTime: string | null;
}

interface SslLabsApiResponse {
  host?: string;
  port?: number;
  protocol?: string;
  status?: string;
  startTime?: number;
  testTime?: number;
  endpoints?: Array<{
    ipAddress?: string;
    grade?: string;
    gradeTrustIgnored?: string;
    hasWarnings?: boolean;
    isExceptional?: boolean;
    delegation?: number;
  }>;
  [key: string]: unknown;
}

/** Retryable status codes from SSL Labs (overloaded / rate-limited). */
function isRetryable(status: number): boolean {
  return status === 429 || status === 529 || status === 503;
}

async function fetchWithRetry(
  url: string,
  signal?: AbortSignal,
  maxRetries = 3,
): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (signal?.aborted) throw new Error('Aborted');

    const res = await fetch(url, { signal });

    if (!isRetryable(res.status) || attempt === maxRetries) {
      return res;
    }

    // Wait 3-6s between retries
    const delay = 3_000 + attempt * 1_500;
    await new Promise((r) => setTimeout(r, delay));
  }

  // Unreachable but satisfies TS
  throw new Error('SSL Labs: max retries exceeded');
}

/**
 * Poll SSL Labs API until the assessment is complete.
 * Uses fromCache=on to avoid triggering new scans (rate-limit friendly).
 * Falls back to startNew=on if no cached result exists.
 */
async function assess(
  host: string,
  timeout: number,
  signal?: AbortSignal,
): Promise<SslLabsApiResponse> {
  const base = 'https://api.ssllabs.com/api/v3/analyze';

  // First try cached result
  const cacheUrl = `${base}?host=${encodeURIComponent(host)}&fromCache=on&maxAge=24`;
  const cacheRes = await fetchWithRetry(cacheUrl, signal);

  if (cacheRes.ok) {
    const data = (await cacheRes.json()) as SslLabsApiResponse;
    if (data.status === 'READY') return data;
    if (data.status === 'ERROR') throw new Error('SSL Labs assessment error');
  } else if (!isRetryable(cacheRes.status)) {
    throw new Error(`SSL Labs API returned ${cacheRes.status}`);
  }

  // No cache — start new assessment (publish=off to be respectful)
  const startUrl = `${base}?host=${encodeURIComponent(host)}&publish=off&all=done`;
  const startRes = await fetchWithRetry(startUrl, signal);

  if (!startRes.ok) {
    if (isRetryable(startRes.status)) {
      throw new Error('SSL Labs is currently overloaded. Try again later.');
    }
    throw new Error(`SSL Labs API returned ${startRes.status}`);
  }

  // Poll until ready (max ~timeout ms)
  const deadline = Date.now() + Math.min(timeout, 90_000);
  const pollUrl = `${base}?host=${encodeURIComponent(host)}&all=done`;

  while (Date.now() < deadline) {
    if (signal?.aborted) throw new Error('Aborted');
    await new Promise((r) => setTimeout(r, 5_000));

    const pollRes = await fetchWithRetry(pollUrl, signal, 1);
    if (!pollRes.ok) continue;

    const data = (await pollRes.json()) as SslLabsApiResponse;
    if (data.status === 'READY') return data;
    if (data.status === 'ERROR') throw new Error('SSL Labs assessment failed');
  }

  throw new Error('SSL Labs assessment timed out — the server may be slow to respond');
}

export const sslLabsHandler: AnalysisHandler<SslLabsResult> = async (url, options) => {
  try {
    const host = extractHostname(url);
    const timeout = options?.timeout ?? 30_000;

    const result = await assess(host, timeout);

    const endpoints: SslLabsEndpoint[] = (result.endpoints ?? []).map((ep) => ({
      ipAddress: ep.ipAddress ?? '',
      grade: ep.grade ?? '?',
      gradeTrustIgnored: ep.gradeTrustIgnored ?? '?',
      hasWarnings: ep.hasWarnings ?? false,
      isExceptional: ep.isExceptional ?? false,
      delegation: ep.delegation ?? 0,
    }));

    const bestGrade = endpoints.length > 0
      ? endpoints.reduce((best, ep) => (ep.grade < best ? ep.grade : best), endpoints[0].grade)
      : null;

    return {
      data: {
        host: result.host ?? host,
        port: result.port ?? 443,
        protocol: result.protocol ?? 'https',
        status: result.status ?? 'UNKNOWN',
        grade: bestGrade,
        gradeTrustIgnored: endpoints[0]?.gradeTrustIgnored ?? null,
        hasWarnings: endpoints.some((ep) => ep.hasWarnings),
        endpoints,
        testTime: result.testTime
          ? new Date(result.testTime).toISOString()
          : null,
      },
    };
  } catch (error) {
    return { error: (error as Error).message };
  }
};
