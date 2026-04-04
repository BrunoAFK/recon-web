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
});

describe('assertPublicHost', () => {
  it('rejects localhost', async () => {
    await expect(assertPublicHost('localhost')).rejects.toThrow('Blocked');
  });

  it('allows public domains', async () => {
    await expect(assertPublicHost('example.com')).resolves.toBeUndefined();
  });
});
