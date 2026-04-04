import dns from 'dns/promises';
import https from 'https';
import type { AnalysisHandler, HandlerResult } from '../types.js';
import { extractHostname } from '../utils/url.js';

interface DnsServerEntry {
  address: string;
  hostname: string[] | null;
  dohDirectSupports: boolean;
}

export interface DnsServerResult {
  domain: string;
  dns: DnsServerEntry[];
}

async function checkDohSupport(address: string): Promise<boolean> {
  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: address,
        path: '/dns-query',
        method: 'GET',
        timeout: 5000,
      },
      () => resolve(true),
    );
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.end();
  });
}

export const dnsServerHandler: AnalysisHandler<DnsServerResult> = async (url, options) => {
  try {
    const domain = extractHostname(url);
    const addresses = await dns.resolve4(domain);

    const results: DnsServerEntry[] = await Promise.all(
      addresses.map(async (address) => {
        const hostname = await dns.reverse(address).catch((): null => null);
        const dohDirectSupports = await checkDohSupport(address);
        return {
          address,
          hostname,
          dohDirectSupports,
        };
      }),
    );

    return {
      data: {
        domain,
        dns: results,
      },
    };
  } catch (error) {
    return { error: `An error occurred while resolving DNS. ${(error as Error).message}` };
  }
};
