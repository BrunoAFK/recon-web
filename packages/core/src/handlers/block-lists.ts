import dns from 'dns';
import type { AnalysisHandler, HandlerResult } from '../types.js';
import { extractHostname } from '../utils/url.js';

interface DnsServer {
  name: string;
  ip: string;
}

export interface BlockListEntry {
  server: string;
  serverIp: string;
  isBlocked: boolean;
}

export interface BlockListsResult {
  blocklists: BlockListEntry[];
}

const DNS_SERVERS: DnsServer[] = [
  { name: 'AdGuard', ip: '176.103.130.130' },
  { name: 'AdGuard Family', ip: '176.103.130.132' },
  { name: 'CleanBrowsing Adult', ip: '185.228.168.10' },
  { name: 'CleanBrowsing Family', ip: '185.228.168.168' },
  { name: 'CleanBrowsing Security', ip: '185.228.168.9' },
  { name: 'CloudFlare', ip: '1.1.1.1' },
  { name: 'CloudFlare Family', ip: '1.1.1.3' },
  { name: 'Comodo Secure', ip: '8.26.56.26' },
  { name: 'Google DNS', ip: '8.8.8.8' },
  { name: 'Neustar Family', ip: '156.154.70.3' },
  { name: 'Neustar Protection', ip: '156.154.70.2' },
  { name: 'Norton Family', ip: '199.85.126.20' },
  { name: 'OpenDNS', ip: '208.67.222.222' },
  { name: 'OpenDNS Family', ip: '208.67.222.123' },
  { name: 'Quad9', ip: '9.9.9.9' },
  { name: 'Yandex Family', ip: '77.88.8.7' },
  { name: 'Yandex Safe', ip: '77.88.8.88' },
];

const knownBlockIPs: string[] = [
  '146.112.61.106',
  '185.228.168.10',
  '8.26.56.26',
  '9.9.9.9',
  '208.69.38.170',
  '208.69.39.170',
  '208.67.222.222',
  '208.67.222.123',
  '199.85.126.10',
  '199.85.126.20',
  '156.154.70.22',
  '77.88.8.7',
  '77.88.8.8',
  '::1',
  '2a02:6b8::feed:0ff',
  '2a02:6b8::feed:bad',
  '2a02:6b8::feed:a11',
  '2620:119:35::35',
  '2620:119:53::53',
  '2606:4700:4700::1111',
  '2606:4700:4700::1001',
  '2001:4860:4860::8888',
  '2a0d:2a00:1::',
  '2a0d:2a00:2::',
];

const isDomainBlocked = (domain: string, serverIP: string): Promise<boolean> => {
  const resolver = new dns.Resolver();
  resolver.setServers([serverIP]);

  return new Promise((resolve) => {
    resolver.resolve4(domain, (err, addresses) => {
      if (!err) {
        resolve(addresses.some((addr) => knownBlockIPs.includes(addr)));
        return;
      }

      resolver.resolve6(domain, (err6, addresses6) => {
        if (!err6) {
          resolve(addresses6.some((addr) => knownBlockIPs.includes(addr)));
          return;
        }
        if (err6.code === 'ENOTFOUND' || err6.code === 'SERVFAIL') {
          resolve(true);
        } else {
          resolve(false);
        }
      });
    });
  });
};

export const blockListsHandler: AnalysisHandler<BlockListsResult> = async (url, options) => {
  try {
    const domain = extractHostname(url);

    const results = await Promise.allSettled(
      DNS_SERVERS.map(async (server) => {
        const isBlocked = await isDomainBlocked(domain, server.ip);
        return {
          server: server.name,
          serverIp: server.ip,
          isBlocked,
        };
      }),
    );

    const blocklists: BlockListEntry[] = results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }
      return {
        server: DNS_SERVERS[index].name,
        serverIp: DNS_SERVERS[index].ip,
        isBlocked: false,
      };
    });

    return { data: { blocklists } };
  } catch (error) {
    return { error: (error as Error).message };
  }
};
