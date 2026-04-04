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

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',
  timeoutLimit: parseInt(process.env.API_TIMEOUT_LIMIT || '30000', 10),
  corsOrigin: process.env.API_CORS_ORIGIN || '*',
  chromePath: detectChromePath(),
  staticDir: process.env.STATIC_DIR || undefined,
  maxConcurrency: parseInt(process.env.MAX_CONCURRENCY || '8', 10),
  dbPath: process.env.DB_PATH || './data/recon-web.db',

  apiKeys: {
    GOOGLE_CLOUD_API_KEY: process.env.GOOGLE_CLOUD_API_KEY || '',
    CLOUDMERSIVE_API_KEY: process.env.CLOUDMERSIVE_API_KEY || '',
    BUILT_WITH_API_KEY: process.env.BUILT_WITH_API_KEY || '',
    TRANCO_API_KEY: process.env.TRANCO_API_KEY || '',
    TRANCO_USERNAME: process.env.TRANCO_USERNAME || '',
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
