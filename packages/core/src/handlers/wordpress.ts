import type { AnalysisHandler } from '../types.js';
import { normalizeUrl } from '../utils/url.js';

export interface WpPlugin {
  slug: string;
  version: string | null;
}

export interface WpTheme {
  slug: string;
  version: string | null;
}

export interface WpExposedFile {
  path: string;
  accessible: boolean;
}

export interface WordPressResult {
  isWordPress: boolean;
  version: string | null;
  plugins: WpPlugin[];
  themes: WpTheme[];
  exposedFiles: WpExposedFile[];
  issues: string[];
}

const EXPOSED_PATHS = [
  'wp-login.php',
  'xmlrpc.php',
  'wp-json/wp/v2/users',
  'readme.html',
  'wp-config.php.bak',
  'wp-content/debug.log',
  '.wp-config.php.swp',
  'wp-admin/install.php',
];

async function fetchText(url: string, timeout: number): Promise<string | null> {
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(timeout),
      headers: { 'User-Agent': 'recon-web/1.0' },
    });
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') ?? '';
    // Only read text-like responses
    if (!ct.includes('text') && !ct.includes('json') && !ct.includes('xml')) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function isAccessible(url: string, timeout: number): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(timeout),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function extractPlugins(html: string): WpPlugin[] {
  const pluginMap = new Map<string, string | null>();
  const regex = /wp-content\/plugins\/([a-zA-Z0-9_-]+)(?:\/[^"'?]*?\?ver=([0-9.]+))?/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const slug = match[1];
    const version = match[2] ?? null;
    if (!pluginMap.has(slug) || (version && !pluginMap.get(slug))) {
      pluginMap.set(slug, version);
    }
  }
  return Array.from(pluginMap, ([slug, version]) => ({ slug, version }));
}

function extractThemes(html: string): WpTheme[] {
  const themeMap = new Map<string, string | null>();
  const regex = /wp-content\/themes\/([a-zA-Z0-9_-]+)(?:\/[^"'?]*?\?ver=([0-9.]+))?/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const slug = match[1];
    const version = match[2] ?? null;
    if (!themeMap.has(slug) || (version && !themeMap.get(slug))) {
      themeMap.set(slug, version);
    }
  }
  return Array.from(themeMap, ([slug, version]) => ({ slug, version }));
}

function extractWpVersion(html: string): string | null {
  // meta generator tag
  const genMatch = html.match(/<meta[^>]+name=["']generator["'][^>]+content=["']WordPress\s+([0-9.]+)["']/i);
  if (genMatch) return genMatch[1];

  // wp-emoji script version
  const emojiMatch = html.match(/wp-emoji-release\.min\.js\?ver=([0-9.]+)/);
  if (emojiMatch) return emojiMatch[1];

  // wp-includes version hints
  const includesMatch = html.match(/wp-includes\/[^"']+\?ver=([0-9.]+)/);
  if (includesMatch) return includesMatch[1];

  return null;
}

export const wordpressHandler: AnalysisHandler<WordPressResult> = async (url, options) => {
  const timeout = Math.min(options?.timeout ?? 10_000, 10_000);
  const normalized = normalizeUrl(url);
  const base = normalized.replace(/\/+$/, '');

  // Fetch homepage HTML
  const html = await fetchText(base, timeout);

  if (!html) {
    return { data: { isWordPress: false, version: null, plugins: [], themes: [], exposedFiles: [], issues: [] } };
  }

  // Detect WordPress
  const hasWpContent = /wp-content\//i.test(html);
  const hasWpIncludes = /wp-includes\//i.test(html);
  const hasGenerator = /WordPress/i.test(html);

  if (!hasWpContent && !hasWpIncludes && !hasGenerator) {
    return { data: { isWordPress: false, version: null, plugins: [], themes: [], exposedFiles: [], issues: [] } };
  }

  // Extract data
  const version = extractWpVersion(html);
  const plugins = extractPlugins(html);
  const themes = extractThemes(html);

  // Check exposed files in parallel
  const exposedChecks = await Promise.all(
    EXPOSED_PATHS.map(async (path) => ({
      path,
      accessible: await isAccessible(`${base}/${path}`, timeout),
    })),
  );
  const exposedFiles = exposedChecks.filter((f) => f.accessible);

  // Identify issues
  const issues: string[] = [];

  if (version) {
    issues.push(`WordPress version ${version} is publicly exposed via meta tags.`);
  }

  if (exposedFiles.some((f) => f.path === 'xmlrpc.php')) {
    issues.push('xmlrpc.php is accessible — commonly exploited for brute-force and DDoS amplification attacks.');
  }

  if (exposedFiles.some((f) => f.path === 'wp-json/wp/v2/users')) {
    issues.push('User enumeration is possible via the REST API (/wp-json/wp/v2/users).');
  }

  if (exposedFiles.some((f) => f.path === 'readme.html')) {
    issues.push('readme.html is accessible — reveals WordPress version to attackers.');
  }

  if (exposedFiles.some((f) => f.path === 'wp-content/debug.log')) {
    issues.push('Debug log is publicly accessible — may contain sensitive error details and file paths.');
  }

  if (exposedFiles.some((f) => f.path === 'wp-admin/install.php')) {
    issues.push('install.php is accessible — if WordPress is misconfigured, this could allow a full takeover.');
  }

  if (exposedFiles.some((f) => f.path === 'wp-config.php.bak' || f.path === '.wp-config.php.swp')) {
    issues.push('A backup of wp-config.php is publicly accessible — this file contains database credentials.');
  }

  for (const plugin of plugins) {
    if (plugin.version) {
      issues.push(`Plugin "${plugin.slug}" exposes version ${plugin.version}.`);
    }
  }

  return {
    data: {
      isWordPress: true,
      version,
      plugins,
      themes,
      exposedFiles,
      issues,
    },
  };
};
