import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface CliConfig {
  apiKeys: Record<string, string>;
  chromePath?: string;
}

const CONFIG_FILENAME = '.recon-web.json';

export function loadConfig(): CliConfig {
  const config: CliConfig = {
    apiKeys: {},
  };

  // Try loading config file from CWD, then home directory
  const paths = [
    resolve(process.cwd(), CONFIG_FILENAME),
    resolve(process.env.HOME || '~', CONFIG_FILENAME),
  ];

  for (const configPath of paths) {
    if (existsSync(configPath)) {
      try {
        const raw = readFileSync(configPath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed.apiKeys && typeof parsed.apiKeys === 'object') {
          config.apiKeys = { ...config.apiKeys, ...parsed.apiKeys };
        }
        if (parsed.chromePath) {
          config.chromePath = parsed.chromePath;
        }
        break; // Use first found config
      } catch {
        // Ignore invalid config files
      }
    }
  }

  // Environment variables override config file
  const envKeys: Record<string, string> = {
    GOOGLE_CLOUD_API_KEY: 'GOOGLE_CLOUD_API_KEY',
    CLOUDMERSIVE_API_KEY: 'CLOUDMERSIVE_API_KEY',
    BUILT_WITH_API_KEY: 'BUILT_WITH_API_KEY',
    TRANCO_API_KEY: 'TRANCO_API_KEY',
    VIRUSTOTAL_API_KEY: 'VIRUSTOTAL_API_KEY',
    ABUSEIPDB_API_KEY: 'ABUSEIPDB_API_KEY',
  };

  for (const [envVar, keyName] of Object.entries(envKeys)) {
    if (process.env[envVar]) {
      config.apiKeys[keyName] = process.env[envVar]!;
    }
  }

  if (process.env.CHROME_PATH) {
    config.chromePath = process.env.CHROME_PATH;
  }

  return config;
}
