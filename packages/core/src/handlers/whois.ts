import net from 'net';
import psl from 'psl';
import type { AnalysisHandler, HandlerResult } from '../types.js';
import { normalizeUrl } from '../utils/url.js';
import { getWhoisServer } from './whois-servers.js';

export interface WhoisResult {
  [key: string]: string;
}

/**
 * Use psl to extract the registrable domain and its TLD.
 * Returns { domain, tld } or throws on failure.
 */
const getDomainAndTld = (hostname: string): { domain: string; tld: string } => {
  const parsed = psl.parse(hostname);
  if ('error' in parsed && parsed.error) {
    throw new Error(`Cannot parse hostname: ${hostname} (${JSON.stringify(parsed.error)})`);
  }
  const { domain, tld } = parsed as psl.ParsedDomain;
  if (!domain || !tld) {
    throw new Error(`Cannot extract domain from hostname: ${hostname}`);
  }
  return { domain, tld };
};

export const parseWhoisData = (data: string): WhoisResult | { error: string; errorCode?: string; errorCategory?: string } => {
  if (data.includes('No match for') || data.includes('NOT FOUND') || data.includes('No Data Found')) {
    return { error: 'No matches found for domain in WHOIS database', errorCode: 'NOT_FOUND', errorCategory: 'info' };
  }

  // Support both \r\n and \n line endings
  const lines = data.split(/\r?\n/);
  const parsedData: Record<string, string> = {};
  let lastKey = '';

  for (const line of lines) {
    if (line.trim().length === 0) continue;
    const index = line.indexOf(':');
    if (index === -1) {
      if (lastKey) {
        parsedData[lastKey] += ' ' + line.trim();
      }
      continue;
    }
    let key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim();
    if (value.length === 0) continue;
    key = key.replace(/\W+/g, '_');
    lastKey = key;
    parsedData[key] = value;
  }

  return parsedData;
};

const queryWhoisServer = (
  hostname: string,
  whoisServer: string,
  timeout: number,
): Promise<WhoisResult> => {
  return new Promise((resolve, reject) => {
    const client = net.createConnection({ port: 43, host: whoisServer }, () => {
      client.write(hostname + '\r\n');
    });

    client.setTimeout(timeout);

    let data = '';
    client.on('data', (chunk: Buffer) => {
      data += chunk;
    });

    client.on('end', () => {
      try {
        const parsed = parseWhoisData(data);
        if ('error' in parsed) {
          reject(new Error(parsed.error));
        } else {
          resolve(parsed);
        }
      } catch (error) {
        reject(error);
      }
    });

    client.on('timeout', () => {
      client.destroy();
      reject(new Error(`WHOIS query to ${whoisServer} timed out`));
    });

    client.on('error', (err) => {
      client.destroy();
      reject(err);
    });
  });
};

export const whoisHandler: AnalysisHandler<WhoisResult> = async (url, options) => {
  let hostname: string;
  let tld: string;
  try {
    const targetUrl = normalizeUrl(url);
    const rawHostname = new URL(targetUrl).hostname;
    const result = getDomainAndTld(rawHostname);
    hostname = result.domain;
    tld = result.tld;
  } catch (error) {
    return { error: `Unable to parse URL: ${(error as Error).message}` };
  }

  const timeout = options?.timeout ?? 10_000;

  // Determine WHOIS server: try multi-part TLD first, then plain TLD, then fallback
  const whoisServer =
    getWhoisServer(tld) ??
    getWhoisServer(tld.split('.').pop()!) ??
    'whois.iana.org';

  // Attempt query with 1 retry on connection error
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const whoisData = await queryWhoisServer(hostname, whoisServer, timeout);
      return { data: whoisData };
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      // Only retry on connection errors (ECONNREFUSED, ECONNRESET, ETIMEDOUT at TCP level)
      const retryable = err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT';
      if (attempt === 0 && retryable) {
        continue;
      }
      return { error: (error as Error).message };
    }
  }

  // Should never reach here, but satisfy TypeScript
  return { error: 'Unexpected error in WHOIS handler' };
};
