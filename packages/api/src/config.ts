import { existsSync } from 'node:fs';
import 'dotenv/config';

function detectChromePath(): string | undefined {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const candidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
  ];
  return candidates.find((p) => existsSync(p));
}

export function envBool(key: string, defaultValue: boolean): boolean {
  const val = process.env[key];
  if (val === undefined || val === '') return defaultValue;
  return val.toLowerCase() !== 'false' && val !== '0';
}

export function envInt(key: string, defaultValue: number): number {
  const val = process.env[key];
  if (val === undefined || val === '') return defaultValue;
  const parsed = parseInt(val, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',
  timeoutLimit: parseInt(process.env.API_TIMEOUT_LIMIT || '30000', 10),
  corsOrigin: process.env.API_CORS_ORIGIN || '*',
  chromePath: detectChromePath(),
  staticDir: process.env.STATIC_DIR || undefined,
  maxConcurrency: parseInt(process.env.MAX_CONCURRENCY || '8', 10),
  maxConcurrentScans: envInt('MAX_CONCURRENT_SCANS', 3),
  dbPath: process.env.DB_PATH || './data/recon-web.db',

  // Demo
  demoScanUrl: process.env.DEMO_SCAN_URL || 'https://example.com',

  apiKeys: {
    GOOGLE_CLOUD_API_KEY: process.env.GOOGLE_CLOUD_API_KEY || '',
    CLOUDMERSIVE_API_KEY: process.env.CLOUDMERSIVE_API_KEY || '',
    BUILT_WITH_API_KEY: process.env.BUILT_WITH_API_KEY || '',
    TRANCO_API_KEY: process.env.TRANCO_API_KEY || '',
    TRANCO_USERNAME: process.env.TRANCO_USERNAME || '',
    VIRUSTOTAL_API_KEY: process.env.VIRUSTOTAL_API_KEY || '',
    ABUSEIPDB_API_KEY: process.env.ABUSEIPDB_API_KEY || '',
  },
} as const;

/** Return only the API keys that have non-empty values. */
export function getPopulatedApiKeys(): Record<string, string> {
  const keys: Record<string, string> = {};
  for (const [k, v] of Object.entries(config.apiKeys)) {
    if (v) keys[k] = v;
  }
  return keys;
}
