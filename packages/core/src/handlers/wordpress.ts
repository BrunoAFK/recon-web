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
    if (!ct.includes('text') && !ct.includes('json') && !ct.includes('xml')) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/**
 * Detect if the server has a catch-all (returns 200 for any path).
 * Probe a random nonsensical path — if it returns 200, the server
 * has a catch-all and we cannot trust status codes for file checks.
 */
async function hasCatchAll(base: string, timeout: number): Promise<boolean> {
  try {
    const res = await fetch(`${base}/wp-content/recon-web-probe-${Date.now()}.php`, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(timeout),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Check if a WordPress-specific path is genuinely accessible.
 *
 * When the server has a catch-all (returns 200 for everything),
 * we require content-based proof for every path. When there's no
 * catch-all, a 200 status with correct content-type is sufficient.
 */
async function isAccessible(
  url: string,
  path: string,
  timeout: number,
  catchAll: boolean,
): Promise<boolean> {
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(timeout),
      headers: { 'User-Agent': 'recon-web/1.0' },
    });
    if (!res.ok) return false;

    const ct = res.headers.get('content-type') ?? '';

    if (path === 'wp-login.php') {
      if (!ct.includes('text/html')) return false;
      const body = await res.text();
      // Real wp-login has a specific login form
      return /loginform|user_login|wp-submit/i.test(body);
    }

    if (path === 'xmlrpc.php') {
      const body = await res.text();
      // Real xmlrpc.php responds with "XML-RPC server accepts POST requests only"
      // or an XML fault response
      return /XML-RPC server|<methodResponse>/i.test(body) || (ct.includes('xml') && !ct.includes('html'));
    }

    if (path === 'wp-json/wp/v2/users') {
      if (!ct.includes('json')) return false;
      const body = await res.text();
      // Real WP users endpoint returns a JSON array with user objects containing "slug"
      return body.startsWith('[') && /\"slug\"/.test(body);
    }

    if (path === 'readme.html') {
      const body = await res.text();
      // Real WP readme.html has a very specific structure
      return /wordpress\.org|WordPress\s+[\d.]+/i.test(body) && /<h1/i.test(body);
    }

    if (path === 'wp-content/debug.log') {
      // Debug log must be plain text, never HTML
      if (ct.includes('text/html')) return false;
      if (catchAll) return false; // Can't verify plain text content reliably
      return true;
    }

    if (path === 'wp-admin/install.php') {
      if (!ct.includes('text/html')) return false;
      const body = await res.text();
      // Real WP install.php has very specific form content
      return /setup-config\.php|install\.css|language-chooser|wp-setup-config/i.test(body);
    }

    if (path === 'wp-config.php.bak' || path === '.wp-config.php.swp') {
      // Must not be HTML — real config backup contains PHP source
      if (ct.includes('text/html')) return false;
      const body = await res.text();
      return /DB_NAME|DB_PASSWORD|AUTH_KEY|SECURE_AUTH_KEY/i.test(body);
    }

    // Unknown path — if server has catch-all, don't trust the 200
    if (catchAll) return false;
    return true;
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
  const genMatch = html.match(/<meta[^>]+name=["']generator["'][^>]+content=["']WordPress\s+([0-9.]+)["']/i);
  if (genMatch) return genMatch[1];

  const emojiMatch = html.match(/wp-emoji-release\.min\.js\?ver=([0-9.]+)/);
  if (emojiMatch) return emojiMatch[1];

  const includesMatch = html.match(/wp-includes\/[^"']+\?ver=([0-9.]+)/);
  if (includesMatch) return includesMatch[1];

  return null;
}

export const wordpressHandler: AnalysisHandler<WordPressResult> = async (url, options) => {
  const timeout = Math.min(options?.timeout ?? 10_000, 10_000);
  const normalized = normalizeUrl(url);
  const base = normalized.replace(/\/+$/, '');

  const html = await fetchText(base, timeout);

  if (!html) {
    return { error: 'WordPress not detected on this site.', errorCategory: 'info' };
  }

  // Detect WordPress from homepage content
  const hasWpContent = /wp-content\//i.test(html);
  const hasWpIncludes = /wp-includes\//i.test(html);
  const hasGenerator = /<meta[^>]+name=["']generator["'][^>]+WordPress/i.test(html);

  if (!hasWpContent && !hasWpIncludes && !hasGenerator) {
    return { error: 'WordPress not detected on this site.', errorCategory: 'info' };
  }

  const version = extractWpVersion(html);
  const plugins = extractPlugins(html);
  const themes = extractThemes(html);

  // Detect catch-all before checking exposed files
  const catchAll = await hasCatchAll(base, timeout);

  // Check exposed files in parallel
  const exposedChecks = await Promise.all(
    EXPOSED_PATHS.map(async (path) => ({
      path,
      accessible: await isAccessible(`${base}/${path}`, path, timeout, catchAll),
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
