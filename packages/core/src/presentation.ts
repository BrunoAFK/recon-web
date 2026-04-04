import type { HandlerMetadata } from './types.js';

type HandlerPresentation = Pick<HandlerMetadata, 'displayName' | 'shortDescription'>;

export const handlerPresentation: Record<string, HandlerPresentation> = {
  dns: {
    displayName: 'DNS Records',
    shortDescription: 'Resolve core DNS records and inspect how the domain routes traffic.',
  },
  'dns-server': {
    displayName: 'DNS Provider',
    shortDescription: 'Identify the authoritative DNS provider and encrypted DNS support.',
  },
  dnssec: {
    displayName: 'DNSSEC',
    shortDescription: 'Verify DNSSEC keys and signatures protecting the zone from tampering.',
  },
  'txt-records': {
    displayName: 'TXT Records',
    shortDescription: 'Review TXT records used for verification, email security, and metadata.',
  },
  'mail-config': {
    displayName: 'Mail Configuration',
    shortDescription: 'Inspect MX records and the mail platform serving the domain.',
  },
  ssl: {
    displayName: 'SSL Certificate',
    shortDescription: 'Inspect certificate issuer, validity, SANs, key details, and trust state.',
  },
  tls: {
    displayName: 'TLS Configuration',
    shortDescription: 'Check protocol support, cipher posture, and TLS validity.',
  },
  hsts: {
    displayName: 'HSTS',
    shortDescription: 'Confirm whether browsers are forced to use HTTPS for this host.',
  },
  'http-security': {
    displayName: 'Security Headers',
    shortDescription: 'Evaluate the HTTP headers that harden the site against common attacks.',
  },
  firewall: {
    displayName: 'Web Application Firewall',
    shortDescription: 'Detect signs of a WAF or reverse-proxy security layer.',
  },
  'security-txt': {
    displayName: 'security.txt',
    shortDescription: 'Look for a published vulnerability disclosure policy.',
  },
  threats: {
    displayName: 'Threat Intelligence',
    shortDescription: 'Cross-check the target against major phishing and malware feeds.',
  },
  'block-lists': {
    displayName: 'Block Lists',
    shortDescription: 'Check whether the domain appears on consumer or enterprise DNS block lists.',
  },
  headers: {
    displayName: 'HTTP Headers',
    shortDescription: 'Capture response headers that reveal caching, software, and routing details.',
  },
  cookies: {
    displayName: 'Cookies',
    shortDescription: 'Inspect cookies and the security flags attached to them.',
  },
  redirects: {
    displayName: 'Redirect Chain',
    shortDescription: 'Follow redirects to the final destination and show each hop.',
  },
  status: {
    displayName: 'HTTP Status',
    shortDescription: 'Measure response status and first-hop responsiveness.',
  },
  ports: {
    displayName: 'Open Ports',
    shortDescription: 'Probe common ports to understand the exposed network surface.',
  },
  'get-ip': {
    displayName: 'IP Address',
    shortDescription: 'Resolve the public IP address currently serving the domain.',
  },
  'trace-route': {
    displayName: 'Traceroute',
    shortDescription: 'Trace the network path from the scanner to the target host.',
  },
  'robots-txt': {
    displayName: 'robots.txt',
    shortDescription: 'Review crawler directives exposed by the website.',
  },
  sitemap: {
    displayName: 'Sitemap',
    shortDescription: 'Inspect XML sitemap coverage and discoverability hints.',
  },
  'social-tags': {
    displayName: 'Social Metadata',
    shortDescription: 'Extract OpenGraph, Twitter, and standard sharing metadata.',
  },
  'linked-pages': {
    displayName: 'Linked Pages',
    shortDescription: 'Summarize internal and external links found on the page.',
  },
  whois: {
    displayName: 'WHOIS',
    shortDescription: 'Look up domain registration and registrar details.',
  },
  archives: {
    displayName: 'Archive History',
    shortDescription: 'Check whether the site has historical captures in the Wayback Machine.',
  },
  rank: {
    displayName: 'Tranco Rank',
    shortDescription: 'Estimate popularity using the Tranco research ranking.',
  },
  'legacy-rank': {
    displayName: 'Umbrella Rank',
    shortDescription: 'Show the historical Cisco Umbrella popularity ranking.',
  },
  carbon: {
    displayName: 'Carbon Estimate',
    shortDescription: 'Estimate the page’s carbon footprint and efficiency profile.',
  },
  quality: {
    displayName: 'PageSpeed Quality',
    shortDescription: 'Pull Lighthouse-style quality and performance diagnostics.',
  },
  features: {
    displayName: 'BuiltWith Features',
    shortDescription: 'Detect higher-level product and platform features used by the site.',
  },
  'tech-stack': {
    displayName: 'Technology Stack',
    shortDescription: 'Detect frameworks, infrastructure, and libraries visible from the page.',
  },
  screenshot: {
    displayName: 'Visual Screenshot',
    shortDescription: 'Capture a rendered snapshot of the target page.',
  },
};

export function getPresentationMetadata(name: string): HandlerPresentation | undefined {
  return handlerPresentation[name];
}
