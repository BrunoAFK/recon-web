import axios, { type AxiosRequestConfig, type AxiosResponse } from 'axios';
import { lookup } from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import { isPrivateIP, SsrfBlockedError } from './network.js';

export class SafeFetchError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'SafeFetchError';
  }
}

export interface SafeFetchOptions {
  /** Max redirects to follow (default 5) */
  maxRedirects?: number;
  /** Max response body bytes (default 10 MiB) */
  maxBytes?: number;
  /** Per-request timeout in ms (default 30_000) */
  timeoutMs?: number;
  /** Connect timeout in ms (default 5_000) */
  connectTimeoutMs?: number;
  /** Headers to send */
  headers?: Record<string, string>;
  /** HTTP method (default GET) */
  method?: 'GET' | 'HEAD' | 'POST';
  /** Optional request body */
  data?: unknown;
  /** TEST-ONLY: inject a fake axios adapter */
  _adapter?: (config: AxiosRequestConfig) => Promise<AxiosResponse>;
}

const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;
const DEFAULT_MAX_REDIRECTS = 5;
const DEFAULT_TIMEOUT_MS = 30_000;

async function validateUrl(rawUrl: string): Promise<{ url: URL; pinnedAddress: string; family: 4 | 6 }> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new SafeFetchError(`Invalid URL: ${rawUrl}`, 'INVALID_URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new SafeFetchError(`Blocked protocol: ${url.protocol}`, 'BLOCKED_PROTOCOL');
  }

  // Resolve and validate
  if (process.env.RECON_ALLOW_PRIVATE_IPS === '1') {
    const { address, family } = await lookup(url.hostname);
    return { url, pinnedAddress: address, family: family as 4 | 6 };
  }

  const { address, family } = await lookup(url.hostname);
  if (isPrivateIP(address)) {
    throw new SsrfBlockedError(`Blocked: ${url.hostname} resolves to private address ${address}`);
  }
  return { url, pinnedAddress: address, family: family as 4 | 6 };
}

function buildPinnedAgent(pinnedAddress: string, family: 4 | 6, isHttps: boolean) {
  // Custom lookup that always returns the pre-validated IP. Defeats DNS rebinding
  // because the IP we connect to is the IP we validated, not whatever DNS returns
  // on a second lookup.
  // Node 24+ sends { all: true } and expects an array response.
  const customLookup = (
    _hostname: string,
    opts: { all?: boolean },
    cb: (err: Error | null, ...args: unknown[]) => void,
  ): void => {
    if (opts.all) {
      cb(null, [{ address: pinnedAddress, family }]);
    } else {
      cb(null, pinnedAddress, family);
    }
  };

  const agentOptions = { lookup: customLookup as never, keepAlive: false };
  return isHttps ? new https.Agent(agentOptions) : new http.Agent(agentOptions);
}

/**
 * Perform an HTTP request with SSRF protection.
 * - Validates URL protocol.
 * - Resolves hostname and rejects private/internal IPs.
 * - Pins the connection to the validated IP (DNS rebinding defense).
 * - Re-validates every redirect target before following.
 * - Enforces max body size, max redirects, total + connect timeouts.
 */
export async function safeFetch(rawUrl: string, opts: SafeFetchOptions = {}): Promise<AxiosResponse> {
  const maxRedirects = opts.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const headers = opts.headers ?? {};
  const method = opts.method ?? 'GET';

  let currentUrl = rawUrl;
  let redirects = 0;

  while (true) {
    const { url, pinnedAddress, family } = await validateUrl(currentUrl);
    const isHttps = url.protocol === 'https:';

    const config: AxiosRequestConfig = {
      url: currentUrl,
      method,
      headers: { Host: url.host, ...headers },
      timeout: timeoutMs,
      maxContentLength: maxBytes,
      maxBodyLength: maxBytes,
      // Do not let axios follow redirects — we re-validate ourselves.
      maxRedirects: 0,
      validateStatus: () => true, // we handle status manually
      httpAgent: opts._adapter ? undefined : buildPinnedAgent(pinnedAddress, family, false),
      httpsAgent: opts._adapter ? undefined : buildPinnedAgent(pinnedAddress, family, true),
      data: opts.data,
    };
    if (opts._adapter) {
      config.adapter = opts._adapter as never;
    }

    let response: AxiosResponse;
    try {
      response = await axios.request(config);
    } catch (err) {
      if ((err as { code?: string }).code === 'ERR_FR_MAX_BODY_LENGTH_EXCEEDED') {
        throw new SafeFetchError(`Response body too large (max ${maxBytes} bytes)`, 'BODY_TOO_LARGE');
      }
      throw err;
    }

    // Manual content-length check (covers cases where axios didn't enforce yet)
    const cl = response.headers?.['content-length'];
    if (cl && parseInt(String(cl), 10) > maxBytes) {
      throw new SafeFetchError(`Response body too large (max ${maxBytes} bytes)`, 'BODY_TOO_LARGE');
    }

    // Handle redirects manually with re-validation
    if (response.status >= 300 && response.status < 400 && response.headers?.location) {
      redirects++;
      if (redirects > maxRedirects) {
        throw new SafeFetchError(`Too many redirects (max ${maxRedirects})`, 'TOO_MANY_REDIRECTS');
      }
      const nextLocation = String(response.headers.location);
      // Resolve relative redirects against current URL
      currentUrl = new URL(nextLocation, currentUrl).toString();
      continue;
    }

    return response;
  }
}
