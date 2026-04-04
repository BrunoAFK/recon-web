import urlParse from 'url-parse';

/**
 * Normalizes a user-provided URL to ensure it has a protocol.
 * Extracted from the original api/_common/middleware.js
 */
export function normalizeUrl(url: string): string {
  if (!url) {
    throw new Error('URL is required');
  }

  let normalized = url.trim();

  // Reject non-HTTP schemes explicitly (e.g. ftp://, file://, gopher://)
  if (normalized.includes('://') &&
      !normalized.startsWith('http://') &&
      !normalized.startsWith('https://')) {
    throw new Error(`Unsupported URL scheme: ${url}`);
  }

  // Add https:// if no protocol is specified
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = `https://${normalized}`;
  }

  // Validate the URL
  const parsed = urlParse(normalized);
  if (!parsed.hostname) {
    throw new Error(`Invalid URL: ${url}`);
  }

  return normalized;
}

/**
 * Extracts the hostname from a URL string.
 */
export function extractHostname(url: string): string {
  const normalized = normalizeUrl(url);
  const parsed = urlParse(normalized);
  return parsed.hostname;
}
