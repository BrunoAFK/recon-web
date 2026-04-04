import dns from 'dns/promises';
import type { AnalysisHandler, HandlerResult } from '../types.js';
import { extractHostname } from '../utils/url.js';

interface DnsLookupResult {
  address: string;
  family: number;
}

interface MxRecord {
  exchange: string;
  priority: number;
}

interface SoaRecord {
  nsname: string;
  hostmaster: string;
  serial: number;
  refresh: number;
  retry: number;
  expire: number;
  minttl: number;
}

interface SrvRecord {
  name: string;
  port: number;
  priority: number;
  weight: number;
}

export interface DnsResult {
  A: DnsLookupResult;
  AAAA: string[];
  MX: MxRecord[];
  TXT: string[][];
  NS: string[];
  CNAME: string[];
  SOA: SoaRecord | null;
  SRV: SrvRecord[];
  PTR: string[];
}

export const dnsHandler: AnalysisHandler<DnsResult> = async (url, options) => {
  try {
    const hostname = extractHostname(url);

    const [a, aaaa, mx, txt, ns, cname, soa, srv, ptr] = await Promise.all([
      dns.lookup(hostname),
      dns.resolve6(hostname).catch((): string[] => []),
      dns.resolveMx(hostname).catch((): MxRecord[] => []),
      dns.resolveTxt(hostname).catch((): string[][] => []),
      dns.resolveNs(hostname).catch((): string[] => []),
      dns.resolveCname(hostname).catch((): string[] => []),
      dns.resolveSoa(hostname).catch((): null => null),
      dns.resolveSrv(hostname).catch((): SrvRecord[] => []),
      dns.resolvePtr(hostname).catch((): string[] => []),
    ]);

    const result: DnsResult = {
      A: a as unknown as DnsLookupResult,
      AAAA: aaaa,
      MX: mx,
      TXT: txt,
      NS: ns,
      CNAME: cname,
      SOA: soa,
      SRV: srv,
      PTR: ptr,
    };

    return { data: result };
  } catch (error) {
    return { error: (error as Error).message };
  }
};
