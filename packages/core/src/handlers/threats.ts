import * as xml2js from 'xml2js';
import type { AnalysisHandler, HandlerResult, HandlerOptions } from '../types.js';
import { extractHostname, normalizeUrl } from '../utils/url.js';
import { withRetry } from '../utils/retry.js';
import { safeFetch } from '../utils/safe-fetch.js';
import { SsrfBlockedError } from '../utils/network.js';

export interface GoogleSafeBrowsingResult {
  unsafe?: boolean;
  details?: unknown[];
  error?: string;
}

export interface UrlHausResult {
  query_status?: string;
  urlhaus_reference?: string;
  urls?: unknown[];
  error?: string;
  [key: string]: unknown;
}

export interface PhishTankResult {
  url0?: unknown;
  in_database?: string;
  phish_detail_page?: string;
  error?: string;
  [key: string]: unknown;
}

export interface CloudmersiveResult {
  CleanResult?: boolean;
  WebsiteThreatType?: string;
  error?: string;
  [key: string]: unknown;
}

export interface ThreatsResult {
  urlHaus: UrlHausResult;
  phishTank: PhishTankResult;
  cloudmersive: CloudmersiveResult;
  safeBrowsing: GoogleSafeBrowsingResult;
}

const getGoogleSafeBrowsingResult = async (
  url: string,
  apiKey?: string,
): Promise<GoogleSafeBrowsingResult> => {
  try {
    if (!apiKey) {
      return { error: 'GOOGLE_CLOUD_API_KEY is required for the Google Safe Browsing check' };
    }
    const apiEndpoint = `https://safebrowsing.googleapis.com/v4/threatMatches:find`;

    const requestBody = {
      threatInfo: {
        threatTypes: [
          'MALWARE',
          'SOCIAL_ENGINEERING',
          'UNWANTED_SOFTWARE',
          'POTENTIALLY_HARMFUL_APPLICATION',
          'API_ABUSE',
        ],
        platformTypes: ['ANY_PLATFORM'],
        threatEntryTypes: ['URL'],
        threatEntries: [{ url }],
      },
    };

    const response = await withRetry(() =>
      safeFetch(apiEndpoint, {
        method: 'POST',
        data: requestBody,
        headers: { 'x-goog-api-key': apiKey },
      }),
    );
    if (response.data && response.data.matches) {
      return { unsafe: true, details: response.data.matches };
    }
    return { unsafe: false };
  } catch (error) {
    return { error: `Request failed: ${(error as Error).message}` };
  }
};

const getUrlHausResult = async (url: string): Promise<UrlHausResult> => {
  try {
    const domain = extractHostname(url);
    const response = await withRetry(() =>
      safeFetch('https://urlhaus-api.abuse.ch/v1/host/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        data: `host=${domain}`,
      }),
    );
    return response.data;
  } catch (error) {
    return { error: `Request to URLHaus failed, ${(error as Error).message}` };
  }
};

const getPhishTankResult = async (url: string): Promise<PhishTankResult> => {
  try {
    const encodedUrl = Buffer.from(url).toString('base64');
    const endpoint = `https://checkurl.phishtank.com/checkurl/?url=${encodedUrl}`;
    const response = await withRetry(() =>
      safeFetch(endpoint, {
        method: 'POST',
        headers: { 'User-Agent': 'phishtank/recon-web' },
        timeoutMs: 3000,
      }),
    );
    const parsed = await xml2js.parseStringPromise(response.data, { explicitArray: false });
    return parsed.response.results;
  } catch (error) {
    return { error: `Request to PhishTank failed: ${(error as Error).message}` };
  }
};

const getCloudmersiveResult = async (
  url: string,
  apiKey?: string,
): Promise<CloudmersiveResult> => {
  if (!apiKey) {
    return { error: 'CLOUDMERSIVE_API_KEY is required for the Cloudmersive check' };
  }
  try {
    const endpoint = 'https://api.cloudmersive.com/virus/scan/website';
    const data = `Url=${encodeURIComponent(url)}`;
    const response = await withRetry(() =>
      safeFetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Apikey: apiKey,
        },
        data,
      }),
    );
    return response.data;
  } catch (error) {
    return { error: `Request to Cloudmersive failed: ${(error as Error).message}` };
  }
};

export const threatsHandler: AnalysisHandler<ThreatsResult> = async (url, options) => {
  try {
    const googleApiKey = options?.apiKeys?.GOOGLE_CLOUD_API_KEY;
    const cloudmersiveApiKey = options?.apiKeys?.CLOUDMERSIVE_API_KEY;

    const [urlHaus, phishTank, cloudmersive, safeBrowsing] = await Promise.all([
      getUrlHausResult(url),
      getPhishTankResult(url),
      getCloudmersiveResult(url, cloudmersiveApiKey),
      getGoogleSafeBrowsingResult(url, googleApiKey),
    ]);

    if (urlHaus.error && phishTank.error && cloudmersive.error && safeBrowsing.error) {
      return {
        error: `All requests failed - ${urlHaus.error} ${phishTank.error} ${cloudmersive.error} ${safeBrowsing.error}`,
      };
    }

    return { data: { urlHaus, phishTank, cloudmersive, safeBrowsing } };
  } catch (error) {
    return { error: (error as Error).message };
  }
};
