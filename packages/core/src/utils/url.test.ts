import { describe, it, expect } from 'vitest';
import { normalizeUrl, extractHostname } from './url.js';

describe('normalizeUrl', () => {
  it('adds https:// when no protocol is specified', () => {
    expect(normalizeUrl('example.com')).toBe('https://example.com');
  });

  it('preserves existing https:// protocol', () => {
    expect(normalizeUrl('https://example.com')).toBe('https://example.com');
  });

  it('preserves existing http:// protocol', () => {
    expect(normalizeUrl('http://example.com')).toBe('http://example.com');
  });

  it('trims whitespace', () => {
    expect(normalizeUrl('  example.com  ')).toBe('https://example.com');
  });

  it('throws on empty string', () => {
    expect(() => normalizeUrl('')).toThrow('URL is required');
  });

  it('throws on undefined/null-like input', () => {
    expect(() => normalizeUrl(undefined as unknown as string)).toThrow('URL is required');
  });

  it('rejects ftp:// scheme', () => {
    expect(() => normalizeUrl('ftp://example.com')).toThrow('Unsupported URL scheme');
  });

  it('rejects file:// scheme', () => {
    expect(() => normalizeUrl('file:///etc/passwd')).toThrow('Unsupported URL scheme');
  });

  it('rejects gopher:// scheme', () => {
    expect(() => normalizeUrl('gopher://evil.com')).toThrow('Unsupported URL scheme');
  });
});

describe('extractHostname', () => {
  it('extracts hostname from a URL with https', () => {
    expect(extractHostname('https://example.com/path?q=1')).toBe('example.com');
  });

  it('extracts hostname from a URL with http', () => {
    expect(extractHostname('http://sub.example.com')).toBe('sub.example.com');
  });

  it('extracts hostname when no protocol is provided', () => {
    expect(extractHostname('example.com')).toBe('example.com');
  });

  it('extracts hostname from URL with port', () => {
    expect(extractHostname('https://example.com:8080/path')).toBe('example.com');
  });
});
