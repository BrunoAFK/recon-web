import { describe, it, expect, afterEach } from 'vitest';
import { loadConfig } from './config.js';

describe('loadConfig', () => {
  const envKeysToClean = [
    'GOOGLE_CLOUD_API_KEY',
    'CLOUDMERSIVE_API_KEY',
    'BUILT_WITH_API_KEY',
    'TRANCO_API_KEY',
    'CHROME_PATH',
  ];

  const savedEnv: Record<string, string | undefined> = {};

  afterEach(() => {
    // Restore original env values
    for (const key of envKeysToClean) {
      if (savedEnv[key] !== undefined) {
        process.env[key] = savedEnv[key];
      } else {
        delete process.env[key];
      }
    }
  });

  function saveAndClearEnv() {
    for (const key of envKeysToClean) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
  }

  it('returns an object with apiKeys', () => {
    const config = loadConfig();
    expect(config).toHaveProperty('apiKeys');
    expect(typeof config.apiKeys).toBe('object');
  });

  it('picks up env vars for API keys', () => {
    saveAndClearEnv();
    process.env.GOOGLE_CLOUD_API_KEY = 'test-google-key-123';

    const config = loadConfig();
    expect(config.apiKeys.GOOGLE_CLOUD_API_KEY).toBe('test-google-key-123');
  });

  it('returns empty apiKeys when no env vars are set and no config file exists', () => {
    saveAndClearEnv();

    const config = loadConfig();
    expect(config.apiKeys.GOOGLE_CLOUD_API_KEY).toBeUndefined();
    expect(config.apiKeys.CLOUDMERSIVE_API_KEY).toBeUndefined();
    expect(config.apiKeys.BUILT_WITH_API_KEY).toBeUndefined();
    expect(config.apiKeys.TRANCO_API_KEY).toBeUndefined();
  });

  it('picks up CHROME_PATH from env', () => {
    saveAndClearEnv();
    process.env.CHROME_PATH = '/usr/bin/chromium';

    const config = loadConfig();
    expect(config.chromePath).toBe('/usr/bin/chromium');
  });
});
