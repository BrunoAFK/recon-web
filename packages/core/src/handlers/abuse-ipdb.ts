import dns from 'dns/promises';
import type { AnalysisHandler } from '../types.js';
import { extractHostname } from '../utils/url.js';

export interface AbuseIpdbResult {
  ipAddress: string;
  isPublic: boolean;
  abuseConfidenceScore: number;
  totalReports: number;
  lastReportedAt: string | null;
  isp: string | null;
  domain: string | null;
  countryCode: string | null;
  usageType: string | null;
  isWhitelisted: boolean;
}

interface AbuseIpdbApiResponse {
  data?: {
    ipAddress?: string;
    isPublic?: boolean;
    abuseConfidenceScore?: number;
    totalReports?: number;
    lastReportedAt?: string | null;
    isp?: string | null;
    domain?: string | null;
    countryCode?: string | null;
    usageType?: string | null;
    isWhitelisted?: boolean;
  };
  errors?: Array<{ detail?: string }>;
}

export const abuseIpdbHandler: AnalysisHandler<AbuseIpdbResult> = async (url, options) => {
  const apiKey = options?.apiKeys?.ABUSEIPDB_API_KEY;
  if (!apiKey) {
    return {
      skipped: 'ABUSEIPDB_API_KEY not configured. Get a free key at https://www.abuseipdb.com/pricing',
      errorCode: 'MISSING_API_KEY',
      errorCategory: 'tool',
    };
  }

  try {
    const hostname = extractHostname(url);
    const { address } = await dns.lookup(hostname);
    const timeout = options?.timeout ?? 10_000;

    const res = await fetch(
      `https://api.abuseipdb.com/api/v2/check?ipAddress=${encodeURIComponent(address)}&maxAgeInDays=90&verbose`,
      {
        headers: {
          Key: apiKey,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(timeout),
      },
    );

    if (res.status === 429) {
      return { error: 'AbuseIPDB rate limit exceeded (1,000 req/day on free tier)', errorCategory: 'tool' };
    }

    if (!res.ok) {
      return { error: `AbuseIPDB returned ${res.status}` };
    }

    const body = (await res.json()) as AbuseIpdbApiResponse;

    if (body.errors?.length) {
      return { error: body.errors[0].detail ?? 'AbuseIPDB error' };
    }

    const d = body.data;
    if (!d) {
      return { error: 'AbuseIPDB returned no data' };
    }

    return {
      data: {
        ipAddress: d.ipAddress ?? address,
        isPublic: d.isPublic ?? true,
        abuseConfidenceScore: d.abuseConfidenceScore ?? 0,
        totalReports: d.totalReports ?? 0,
        lastReportedAt: d.lastReportedAt ?? null,
        isp: d.isp ?? null,
        domain: d.domain ?? null,
        countryCode: d.countryCode ?? null,
        usageType: d.usageType ?? null,
        isWhitelisted: d.isWhitelisted ?? false,
      },
    };
  } catch (error) {
    return { error: (error as Error).message };
  }
};
