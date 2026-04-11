import { describe, it, expect, vi } from 'vitest';
import { isPrivateIP, assertPublicHost } from './network.js';

describe('isPrivateIP', () => {
  it('detects loopback IPv4', () => {
    expect(isPrivateIP('127.0.0.1')).toBe(true);
    expect(isPrivateIP('127.255.255.255')).toBe(true);
  });

  it('detects 10.x.x.x range', () => {
    expect(isPrivateIP('10.0.0.1')).toBe(true);
    expect(isPrivateIP('10.255.255.255')).toBe(true);
  });

  it('detects 172.16-31.x.x range', () => {
    expect(isPrivateIP('172.16.0.1')).toBe(true);
    expect(isPrivateIP('172.31.255.255')).toBe(true);
    expect(isPrivateIP('172.15.0.1')).toBe(false);
    expect(isPrivateIP('172.32.0.1')).toBe(false);
  });

  it('detects 192.168.x.x range', () => {
    expect(isPrivateIP('192.168.0.1')).toBe(true);
    expect(isPrivateIP('192.168.255.255')).toBe(true);
  });

  it('detects link-local IPv4', () => {
    expect(isPrivateIP('169.254.169.254')).toBe(true);
  });

  it('detects 0.0.0.0', () => {
    expect(isPrivateIP('0.0.0.0')).toBe(true);
  });

  it('allows public IPv4', () => {
    expect(isPrivateIP('8.8.8.8')).toBe(false);
    expect(isPrivateIP('93.184.216.34')).toBe(false);
    expect(isPrivateIP('1.1.1.1')).toBe(false);
  });

  it('detects loopback IPv6', () => {
    expect(isPrivateIP('::1')).toBe(true);
  });

  it('detects link-local IPv6', () => {
    expect(isPrivateIP('fe80::1')).toBe(true);
  });

  it('detects ULA IPv6', () => {
    expect(isPrivateIP('fc00::1')).toBe(true);
    expect(isPrivateIP('fd12::1')).toBe(true);
  });

  it('allows public IPv6', () => {
    expect(isPrivateIP('2001:4860:4860::8888')).toBe(false);
  });

  it('detects 0.0.0.0/8 unspecified range', () => {
    expect(isPrivateIP('0.0.0.0')).toBe(true);
    expect(isPrivateIP('0.255.255.255')).toBe(true);
  });

  it('detects 100.64.0.0/10 CGNAT range', () => {
    expect(isPrivateIP('100.64.0.1')).toBe(true);
    expect(isPrivateIP('100.127.255.255')).toBe(true);
    expect(isPrivateIP('100.63.255.255')).toBe(false);
    expect(isPrivateIP('100.128.0.0')).toBe(false);
  });

  it('detects 198.18.0.0/15 benchmark range', () => {
    expect(isPrivateIP('198.18.0.1')).toBe(true);
    expect(isPrivateIP('198.19.255.255')).toBe(true);
    expect(isPrivateIP('198.17.255.255')).toBe(false);
    expect(isPrivateIP('198.20.0.0')).toBe(false);
  });

  it('detects 224.0.0.0/4 multicast range', () => {
    expect(isPrivateIP('224.0.0.1')).toBe(true);
    expect(isPrivateIP('239.255.255.255')).toBe(true);
  });

  it('detects 240.0.0.0/4 reserved range', () => {
    expect(isPrivateIP('240.0.0.1')).toBe(true);
    expect(isPrivateIP('255.255.255.254')).toBe(true);
  });

  it('detects metadata service IP explicitly', () => {
    expect(isPrivateIP('169.254.169.254')).toBe(true);
    expect(isPrivateIP('169.254.170.2')).toBe(true); // ECS task metadata
  });
});

describe('isPrivateIP IPv6', () => {
  it('detects loopback', () => {
    expect(isPrivateIP('::1')).toBe(true);
  });
  it('detects ULA fc00::/7', () => {
    expect(isPrivateIP('fc00::1')).toBe(true);
    expect(isPrivateIP('fdff:ffff:ffff:ffff:ffff:ffff:ffff:ffff')).toBe(true);
  });
  it('detects link-local fe80::/10', () => {
    expect(isPrivateIP('fe80::1')).toBe(true);
    expect(isPrivateIP('febf::ffff')).toBe(true);
  });
  it('detects multicast ff00::/8', () => {
    expect(isPrivateIP('ff00::1')).toBe(true);
    expect(isPrivateIP('ff02::1')).toBe(true);
  });
  it('detects documentation 2001:db8::/32', () => {
    expect(isPrivateIP('2001:db8::1')).toBe(true);
  });
  it('detects IPv4-mapped private addresses', () => {
    expect(isPrivateIP('::ffff:127.0.0.1')).toBe(true);
    expect(isPrivateIP('::ffff:169.254.169.254')).toBe(true);
    expect(isPrivateIP('::ffff:10.0.0.1')).toBe(true);
  });
  it('does not flag public IPv6', () => {
    expect(isPrivateIP('2606:4700:4700::1111')).toBe(false); // Cloudflare
    expect(isPrivateIP('2001:4860:4860::8888')).toBe(false); // Google
  });
});

describe('assertPublicHost', () => {
  it('rejects localhost', async () => {
    await expect(assertPublicHost('localhost')).rejects.toThrow('Blocked');
  });

  it('allows public domains', async () => {
    await expect(assertPublicHost('example.com')).resolves.toBeDefined();
  });
});
