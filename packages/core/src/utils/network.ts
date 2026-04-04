import { lookup } from 'node:dns/promises';

function isPrivateIPv4(ip: string): boolean {
  if (ip === '0.0.0.0') return true;
  if (ip.startsWith('127.')) return true;
  if (ip.startsWith('10.')) return true;
  if (ip.startsWith('169.254.')) return true;
  if (ip.startsWith('192.168.')) return true;
  // 172.16.0.0/12
  if (ip.startsWith('172.')) {
    const second = parseInt(ip.split('.')[1], 10);
    if (second >= 16 && second <= 31) return true;
  }
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  if (ip === '::1') return true;
  if (ip.startsWith('fe80:')) return true;
  if (ip.startsWith('fc') || ip.startsWith('fd')) return true;
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
 */
export async function assertPublicHost(hostname: string): Promise<void> {
  const { address, family } = await lookup(hostname);
  const isPrivate = family === 4 ? isPrivateIPv4(address) : isPrivateIPv6(address);
  if (isPrivate) {
    throw new Error(`Blocked: ${hostname} resolves to private address ${address}`);
  }
}
