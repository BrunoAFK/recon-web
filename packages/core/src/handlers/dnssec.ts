import https from 'https';
import type { AnalysisHandler, HandlerResult } from '../types.js';
import { extractHostname } from '../utils/url.js';

interface DnsAnswer {
  name: string;
  type: number;
  TTL: number;
  data: string;
}

interface DnsGoogleResponse {
  Answer?: DnsAnswer[];
  [key: string]: unknown;
}

interface DnssecRecord {
  isFound: boolean;
  answer: DnsAnswer[] | null;
  response: DnsAnswer[] | DnsGoogleResponse;
}

export interface DnssecResult {
  DNSKEY: DnssecRecord;
  DS: DnssecRecord;
  RRSIG: DnssecRecord;
}

function queryGoogleDns(domain: string, type: string): Promise<DnsGoogleResponse> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'dns.google',
        path: `/resolve?name=${encodeURIComponent(domain)}&type=${type}`,
        method: 'GET',
        headers: {
          Accept: 'application/dns-json',
        },
      },
      (res) => {
        let data = '';

        res.on('data', (chunk: Buffer) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            reject(new Error('Invalid JSON response'));
          }
        });

        res.on('error', (error: Error) => {
          reject(error);
        });
      },
    );

    req.end();
  });
}

export const dnssecHandler: AnalysisHandler<DnssecResult> = async (url, options) => {
  try {
    const domain = extractHostname(url);
    const dnsTypes = ['DNSKEY', 'DS', 'RRSIG'] as const;
    const records: Record<string, DnssecRecord> = {};

    for (const type of dnsTypes) {
      const dnsResponse = await queryGoogleDns(domain, type);

      if (dnsResponse.Answer) {
        records[type] = {
          isFound: true,
          answer: dnsResponse.Answer,
          response: dnsResponse.Answer,
        };
      } else {
        records[type] = {
          isFound: false,
          answer: null,
          response: dnsResponse,
        };
      }
    }

    return { data: { DNSKEY: records['DNSKEY'], DS: records['DS'], RRSIG: records['RRSIG'] } };
  } catch (error) {
    return { error: (error as Error).message };
  }
};
