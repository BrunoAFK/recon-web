/** CF Pages Function: GET /api/handlers — list available handlers with light mode indicator */

// HTTP-only handlers that work in CF Workers runtime (no Node.js APIs needed)
const HTTP_HANDLERS = [
  { name: 'headers', description: 'Fetch HTTP response headers', category: 'network' },
  { name: 'cookies', description: 'Extract cookies from HTTP response', category: 'network' },
  { name: 'redirects', description: 'Follow and record redirect chain', category: 'network' },
  { name: 'status', description: 'Check HTTP status code and response time', category: 'network' },
  { name: 'hsts', description: 'Check HSTS header and preload status', category: 'security' },
  { name: 'http-security', description: 'Score HTTP security headers', category: 'security' },
  { name: 'security-txt', description: 'Fetch and parse security.txt file', category: 'security' },
  { name: 'robots-txt', description: 'Fetch and parse robots.txt', category: 'content' },
  { name: 'sitemap', description: 'Fetch and parse XML sitemap', category: 'content' },
  { name: 'social-tags', description: 'Extract OpenGraph, Twitter Cards, and meta tags', category: 'content' },
  { name: 'linked-pages', description: 'Analyze internal and external links', category: 'content' },
  { name: 'tech-stack', description: 'Detect technologies from headers and HTML patterns', category: 'meta' },
  { name: 'archives', description: 'Check Wayback Machine archive history', category: 'meta' },
  { name: 'carbon', description: 'Estimate website carbon footprint', category: 'performance' },
  { name: 'tls', description: 'Analyze TLS configuration via Mozilla Observatory', category: 'security' },
  { name: 'dnssec', description: 'Check DNSSEC configuration via Google DoH', category: 'dns' },
];

// Full-scan-only handlers (require Node.js APIs)
const FULL_ONLY_HANDLERS = [
  { name: 'dns', description: 'Resolve DNS records', category: 'dns' },
  { name: 'dns-server', description: 'Identify DNS server', category: 'dns' },
  { name: 'txt-records', description: 'Retrieve TXT records', category: 'dns' },
  { name: 'mail-config', description: 'Analyze MX records', category: 'dns' },
  { name: 'ssl', description: 'Fetch SSL/TLS certificate details', category: 'security' },
  { name: 'firewall', description: 'Detect WAF', category: 'security' },
  { name: 'threats', description: 'Check threat intelligence databases', category: 'security' },
  { name: 'block-lists', description: 'Check DNS block lists', category: 'security' },
  { name: 'ports', description: 'Scan common open ports', category: 'network' },
  { name: 'get-ip', description: 'Resolve IP address', category: 'network' },
  { name: 'trace-route', description: 'Trace network route', category: 'network' },
  { name: 'whois', description: 'WHOIS domain lookup', category: 'meta' },
  { name: 'rank', description: 'Tranco domain ranking', category: 'meta' },
  { name: 'legacy-rank', description: 'Umbrella/Cisco ranking', category: 'meta' },
  { name: 'quality', description: 'Google PageSpeed analysis', category: 'performance' },
  { name: 'features', description: 'BuiltWith feature detection', category: 'meta' },
  { name: 'screenshot', description: 'Capture website screenshot', category: 'meta' },
];

export const onRequestGet: PagesFunction = async () => {
  const all = [
    ...HTTP_HANDLERS.map((h) => ({ ...h, lightMode: true })),
    ...FULL_ONLY_HANDLERS.map((h) => ({ ...h, lightMode: false })),
  ];

  return new Response(JSON.stringify(all), {
    headers: { 'Content-Type': 'application/json' },
  });
};
