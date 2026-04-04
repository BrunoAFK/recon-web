import type { AnalysisHandler, HandlerMetadata, HandlerRegistryEntry } from './types.js';

import { archivesHandler } from './handlers/archives.js';
import { blockListsHandler } from './handlers/block-lists.js';
import { carbonHandler } from './handlers/carbon.js';
import { cookiesHandler } from './handlers/cookies.js';
import { dnsHandler } from './handlers/dns.js';
import { dnsServerHandler } from './handlers/dns-server.js';
import { dnssecHandler } from './handlers/dnssec.js';
import { featuresHandler } from './handlers/features.js';
import { firewallHandler } from './handlers/firewall.js';
import { getIpHandler } from './handlers/get-ip.js';
import { headersHandler } from './handlers/headers.js';
import { hstsHandler } from './handlers/hsts.js';
import { httpSecurityHandler } from './handlers/http-security.js';
import { legacyRankHandler } from './handlers/legacy-rank.js';
import { linkedPagesHandler } from './handlers/linked-pages.js';
import { mailConfigHandler } from './handlers/mail-config.js';
import { portsHandler } from './handlers/ports.js';
import { qualityHandler } from './handlers/quality.js';
import { rankHandler } from './handlers/rank.js';
import { redirectsHandler } from './handlers/redirects.js';
import { robotsTxtHandler } from './handlers/robots-txt.js';
import { screenshotHandler } from './handlers/screenshot.js';
import { securityTxtHandler } from './handlers/security-txt.js';
import { sitemapHandler } from './handlers/sitemap.js';
import { socialTagsHandler } from './handlers/social-tags.js';
import { sslHandler } from './handlers/ssl.js';
import { statusHandler } from './handlers/status.js';
import { techStackHandler } from './handlers/tech-stack.js';
import { threatsHandler } from './handlers/threats.js';
import { tlsHandler } from './handlers/tls.js';
import { traceRouteHandler } from './handlers/trace-route.js';
import { txtRecordsHandler } from './handlers/txt-records.js';
import { whoisHandler } from './handlers/whois.js';

export const registry: Record<string, HandlerRegistryEntry> = {
  dns: {
    handler: dnsHandler,
    metadata: {
      name: 'dns',
      description: 'Resolve DNS records (A, AAAA, MX, TXT, NS, CNAME, SOA, SRV, PTR)',
      category: 'dns',
      requires: ['dns'],
    },
  },
  'dns-server': {
    handler: dnsServerHandler,
    metadata: {
      name: 'dns-server',
      description: 'Identify DNS server and check DoH support',
      category: 'dns',
      requires: ['dns'],
    },
  },
  dnssec: {
    handler: dnssecHandler,
    metadata: {
      name: 'dnssec',
      description: 'Check DNSSEC configuration (DNSKEY, DS, RRSIG)',
      category: 'dns',
      requires: ['http'],
    },
  },
  'txt-records': {
    handler: txtRecordsHandler,
    metadata: {
      name: 'txt-records',
      description: 'Retrieve and parse TXT records',
      category: 'dns',
      requires: ['dns'],
    },
  },
  'mail-config': {
    handler: mailConfigHandler,
    metadata: {
      name: 'mail-config',
      description: 'Analyze MX records and mail provider configuration',
      category: 'dns',
      requires: ['dns'],
    },
  },
  ssl: {
    handler: sslHandler,
    metadata: {
      name: 'ssl',
      description: 'Fetch and analyze SSL/TLS certificate details',
      category: 'security',
      requires: ['tls'],
    },
  },
  tls: {
    handler: tlsHandler,
    metadata: {
      name: 'tls',
      description: 'Analyze TLS configuration via Mozilla Observatory',
      category: 'security',
      requires: ['http'],
    },
  },
  hsts: {
    handler: hstsHandler,
    metadata: {
      name: 'hsts',
      description: 'Check HSTS header and preload status',
      category: 'security',
      requires: ['http'],
    },
  },
  'http-security': {
    handler: httpSecurityHandler,
    metadata: {
      name: 'http-security',
      description: 'Score HTTP security headers (CSP, X-Frame-Options, etc.)',
      category: 'security',
      requires: ['http'],
    },
  },
  firewall: {
    handler: firewallHandler,
    metadata: {
      name: 'firewall',
      description: 'Detect Web Application Firewall (WAF)',
      category: 'security',
      requires: ['dns'],
    },
  },
  'security-txt': {
    handler: securityTxtHandler,
    metadata: {
      name: 'security-txt',
      description: 'Fetch and parse security.txt file',
      category: 'security',
      requires: ['http'],
    },
  },
  threats: {
    handler: threatsHandler,
    metadata: {
      name: 'threats',
      description: 'Check against threat intelligence databases',
      category: 'security',
      requiresApiKey: ['GOOGLE_CLOUD_API_KEY', 'CLOUDMERSIVE_API_KEY'],
      requires: ['http'],
    },
  },
  'block-lists': {
    handler: blockListsHandler,
    metadata: {
      name: 'block-lists',
      description: 'Check if domain is on DNS block lists',
      category: 'security',
      requires: ['dns'],
    },
  },
  headers: {
    handler: headersHandler,
    metadata: {
      name: 'headers',
      description: 'Fetch HTTP response headers',
      category: 'network',
      requires: ['http'],
    },
  },
  cookies: {
    handler: cookiesHandler,
    metadata: {
      name: 'cookies',
      description: 'Extract cookies from HTTP response',
      category: 'network',
      requires: ['http'],
    },
  },
  redirects: {
    handler: redirectsHandler,
    metadata: {
      name: 'redirects',
      description: 'Follow and record redirect chain',
      category: 'network',
      requires: ['http'],
    },
  },
  status: {
    handler: statusHandler,
    metadata: {
      name: 'status',
      description: 'Check HTTP status code and response time',
      category: 'network',
      requires: ['http'],
    },
  },
  ports: {
    handler: portsHandler,
    metadata: {
      name: 'ports',
      description: 'Scan common open ports',
      category: 'network',
      requires: ['tcp'],
    },
  },
  'get-ip': {
    handler: getIpHandler,
    metadata: {
      name: 'get-ip',
      description: 'Resolve IP address for domain',
      category: 'network',
      requires: ['dns'],
    },
  },
  'trace-route': {
    handler: traceRouteHandler,
    metadata: {
      name: 'trace-route',
      description: 'Trace network route to host',
      category: 'network',
      requires: ['subprocess'],
    },
  },
  'robots-txt': {
    handler: robotsTxtHandler,
    metadata: {
      name: 'robots-txt',
      description: 'Fetch and parse robots.txt',
      category: 'content',
      requires: ['http'],
    },
  },
  sitemap: {
    handler: sitemapHandler,
    metadata: {
      name: 'sitemap',
      description: 'Fetch and parse XML sitemap',
      category: 'content',
      requires: ['http'],
    },
  },
  'social-tags': {
    handler: socialTagsHandler,
    metadata: {
      name: 'social-tags',
      description: 'Extract OpenGraph, Twitter Cards, and meta tags',
      category: 'content',
      requires: ['http'],
    },
  },
  'linked-pages': {
    handler: linkedPagesHandler,
    metadata: {
      name: 'linked-pages',
      description: 'Analyze internal and external links',
      category: 'content',
      requires: ['http'],
    },
  },
  whois: {
    handler: whoisHandler,
    metadata: {
      name: 'whois',
      description: 'WHOIS domain registration lookup',
      category: 'meta',
      requires: ['tcp'],
    },
  },
  archives: {
    handler: archivesHandler,
    metadata: {
      name: 'archives',
      description: 'Check Wayback Machine archive history',
      category: 'meta',
      requires: ['http'],
    },
  },
  rank: {
    handler: rankHandler,
    metadata: {
      name: 'rank',
      description: 'Check Tranco domain popularity ranking',
      category: 'meta',
      requiresApiKey: ['TRANCO_API_KEY'],
      requires: ['http'],
    },
  },
  'legacy-rank': {
    handler: legacyRankHandler,
    metadata: {
      name: 'legacy-rank',
      description: 'Check Umbrella/Cisco domain ranking',
      category: 'meta',
      requires: ['http'],
    },
  },
  carbon: {
    handler: carbonHandler,
    metadata: {
      name: 'carbon',
      description: 'Estimate website carbon footprint',
      category: 'performance',
      requires: ['http'],
    },
  },
  quality: {
    handler: qualityHandler,
    metadata: {
      name: 'quality',
      description: 'Google PageSpeed Insights analysis',
      category: 'performance',
      requiresApiKey: ['GOOGLE_CLOUD_API_KEY'],
      requires: ['http'],
    },
  },
  features: {
    handler: featuresHandler,
    metadata: {
      name: 'features',
      description: 'Detect site features via BuiltWith',
      category: 'meta',
      requiresApiKey: ['BUILT_WITH_API_KEY'],
      requires: ['http'],
    },
  },
  'tech-stack': {
    handler: techStackHandler,
    metadata: {
      name: 'tech-stack',
      description: 'Detect technologies from headers, meta tags, and HTML patterns',
      category: 'meta',
      requires: ['http'],
    },
  },
  screenshot: {
    handler: screenshotHandler,
    metadata: {
      name: 'screenshot',
      description: 'Capture website screenshot',
      category: 'meta',
      requiresChromium: true,
      requires: ['http'],
    },
  },
};

export type HandlerName = keyof typeof registry;

export function getHandler(name: string): HandlerRegistryEntry | undefined {
  return registry[name];
}

export function getHandlerNames(): string[] {
  return Object.keys(registry);
}

export function getHandlersByCategory(category: string): HandlerRegistryEntry[] {
  return Object.values(registry).filter(
    (entry) => entry.metadata.category === category,
  );
}

/** Return handler names that only need HTTP (suitable for CF Workers / edge runtimes). */
export function getHttpOnlyHandlers(): string[] {
  return getHandlerNames().filter((name) => {
    const reqs = registry[name].metadata.requires ?? ['http'];
    return reqs.every((r) => r === 'http');
  });
}
