import { lookup } from 'node:dns/promises';

export class SsrfBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SsrfBlockedError';
  }
}

function ipv4ToInt(ip: string): number {
  const parts = ip.split('.').map((p) => parseInt(p, 10));
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) {
    return -1;
  }
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function inCidr4(ip: string, base: string, prefix: number): boolean {
  const ipInt = ipv4ToInt(ip);
  const baseInt = ipv4ToInt(base);
  if (ipInt < 0 || baseInt < 0) return false;
  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  return (ipInt & mask) === (baseInt & mask);
}

const BLOCKED_V4_CIDRS: Array<[string, number]> = [
  ['0.0.0.0', 8],       // "this network" / unspecified
  ['10.0.0.0', 8],      // RFC1918
  ['100.64.0.0', 10],   // CGNAT (RFC6598)
  ['127.0.0.0', 8],     // loopback
  ['169.254.0.0', 16],  // link-local incl. cloud metadata 169.254.169.254
  ['172.16.0.0', 12],   // RFC1918
  ['192.0.0.0', 24],    // IETF protocol assignments
  ['192.0.2.0', 24],    // TEST-NET-1
  ['192.168.0.0', 16],  // RFC1918
  ['198.18.0.0', 15],   // benchmark
  ['198.51.100.0', 24], // TEST-NET-2
  ['203.0.113.0', 24],  // TEST-NET-3
  ['224.0.0.0', 4],     // multicast
  ['240.0.0.0', 4],     // reserved
];

function isPrivateIPv4(ip: string): boolean {
  return BLOCKED_V4_CIDRS.some(([base, prefix]) => inCidr4(ip, base, prefix));
}

function expandIPv6(ip: string): string {
  // Handle IPv4-mapped (::ffff:1.2.3.4)
  const ipv4MappedMatch = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (ipv4MappedMatch) {
    const v4 = ipv4MappedMatch[1];
    const parts = v4.split('.').map((p) => parseInt(p, 10));
    const high = ((parts[0] << 8) | parts[1]).toString(16).padStart(4, '0');
    const low = ((parts[2] << 8) | parts[3]).toString(16).padStart(4, '0');
    return `0000:0000:0000:0000:0000:ffff:${high}:${low}`;
  }
  // Expand "::" shorthand
  let segments: string[];
  if (ip.includes('::')) {
    const [head, tail] = ip.split('::');
    const headSegs = head ? head.split(':') : [];
    const tailSegs = tail ? tail.split(':') : [];
    const missing = 8 - headSegs.length - tailSegs.length;
    segments = [...headSegs, ...Array(missing).fill('0'), ...tailSegs];
  } else {
    segments = ip.split(':');
  }
  return segments.map((s) => s.padStart(4, '0').toLowerCase()).join(':');
}

function isPrivateIPv6(ip: string): boolean {
  // Handle IPv4-mapped: re-evaluate the embedded IPv4
  const ipv4MappedMatch = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (ipv4MappedMatch) {
    return isPrivateIPv4(ipv4MappedMatch[1]);
  }

  const expanded = expandIPv6(ip);
  const firstByte = parseInt(expanded.slice(0, 2), 16);

  if (expanded === '0000:0000:0000:0000:0000:0000:0000:0001') return true; // ::1
  if (expanded === '0000:0000:0000:0000:0000:0000:0000:0000') return true; // ::
  if ((firstByte & 0xfe) === 0xfc) return true; // fc00::/7 ULA
  if (firstByte === 0xff) return true; // ff00::/8 multicast
  if (expanded.startsWith('fe8') || expanded.startsWith('fe9') || expanded.startsWith('fea') || expanded.startsWith('feb')) {
    return true; // fe80::/10 link-local
  }
  if (expanded.startsWith('2001:0db8:')) return true; // documentation
  return false;
}

/**
 * Check whether an IP address belongs to a private/internal range.
 * Exported for testing.
 */
export function isPrivateIP(ip: string): boolean {
  return ip.includes(':') ? isPrivateIPv6(ip) : isPrivateIPv4(ip);
}

/**
 * Resolve hostname and throw if it points to a private/internal IP address.
 * Prevents SSRF attacks by blocking requests to internal services.
 * Returns the resolved IP for the caller to pin against.
 */
export async function assertPublicHost(hostname: string): Promise<{ address: string; family: 4 | 6 }> {
  if (process.env.RECON_ALLOW_PRIVATE_IPS === '1') {
    const { address, family } = await lookup(hostname);
    return { address, family: family as 4 | 6 };
  }
  // Resolve all addresses; reject if ANY is private (defeats DNS rebinding partially)
  const { address, family } = await lookup(hostname);
  if (isPrivateIP(address)) {
    throw new SsrfBlockedError(`Blocked: ${hostname} resolves to private address ${address}`);
  }
  return { address, family: family as 4 | 6 };
}
