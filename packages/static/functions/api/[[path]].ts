/**
 * CF Pages Function: catch-all for /api/* routes.
 *
 * Runs HTTP-only handlers directly in the Workers runtime using fetch().
 * Handlers requiring Node.js APIs (dns, tcp, tls, subprocess) return a
 * "skipped" result indicating they're only available in full-scan mode.
 */

// Handler names that can run in CF Workers (HTTP-only)
const LIGHT_HANDLERS = new Set([
  'headers', 'cookies', 'redirects', 'status',
  'hsts', 'http-security', 'security-txt',
  'robots-txt', 'sitemap', 'social-tags', 'linked-pages',
  'tech-stack', 'archives', 'carbon', 'tls', 'dnssec',
]);

interface HandlerResult {
  data?: unknown;
  error?: string;
  skipped?: string;
}

function normalizeUrl(raw: string): string {
  if (!raw.startsWith('http://') && !raw.startsWith('https://')) {
    return `https://${raw}`;
  }
  return raw;
}

/** Simple HTTP-based handler implementations for the edge */
async function runLightHandler(name: string, targetUrl: string): Promise<HandlerResult> {
  const url = normalizeUrl(targetUrl);

  try {
    switch (name) {
      case 'headers': {
        const res = await fetch(url, { redirect: 'follow' });
        const headers: Record<string, string> = {};
        res.headers.forEach((v, k) => { headers[k] = v; });
        return { data: headers };
      }

      case 'status': {
        const start = Date.now();
        const res = await fetch(url, { redirect: 'follow' });
        const responseTime = Date.now() - start;
        return { data: { statusCode: res.status, responseTime } };
      }

      case 'redirects': {
        const res = await fetch(url, { redirect: 'manual' });
        const location = res.headers.get('location');
        return {
          data: {
            statusCode: res.status,
            redirected: res.redirected,
            location: location ?? null,
          },
        };
      }

      case 'cookies': {
        const res = await fetch(url, { redirect: 'follow' });
        const setCookie = res.headers.get('set-cookie');
        return { data: { cookies: setCookie ? setCookie.split(',').map(c => c.trim()) : [] } };
      }

      case 'hsts': {
        const res = await fetch(url, { redirect: 'follow' });
        const hsts = res.headers.get('strict-transport-security');
        return { data: { hasHsts: !!hsts, header: hsts } };
      }

      case 'http-security': {
        const res = await fetch(url, { redirect: 'follow' });
        const secHeaders = ['content-security-policy', 'x-frame-options', 'x-content-type-options',
          'x-xss-protection', 'referrer-policy', 'permissions-policy'];
        const found: Record<string, string | null> = {};
        for (const h of secHeaders) {
          found[h] = res.headers.get(h);
        }
        return { data: found };
      }

      case 'security-txt': {
        const res = await fetch(`${url}/.well-known/security.txt`, { redirect: 'follow' });
        if (!res.ok) return { data: { found: false } };
        const text = await res.text();
        return { data: { found: true, content: text.slice(0, 2000) } };
      }

      case 'robots-txt': {
        const origin = new URL(url).origin;
        const res = await fetch(`${origin}/robots.txt`, { redirect: 'follow' });
        if (!res.ok) return { data: { found: false } };
        const text = await res.text();
        return { data: { found: true, content: text.slice(0, 5000) } };
      }

      case 'sitemap': {
        const origin = new URL(url).origin;
        const res = await fetch(`${origin}/sitemap.xml`, { redirect: 'follow' });
        if (!res.ok) return { data: { found: false } };
        const text = await res.text();
        return { data: { found: true, urlCount: (text.match(/<loc>/g) || []).length } };
      }

      case 'social-tags': {
        const res = await fetch(url, { redirect: 'follow' });
        const html = await res.text();
        const ogTitle = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]*)"/) ;
        const ogDesc = html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]*)"/);
        const ogImage = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]*)"/);
        return {
          data: {
            ogTitle: ogTitle?.[1] ?? null,
            ogDescription: ogDesc?.[1] ?? null,
            ogImage: ogImage?.[1] ?? null,
          },
        };
      }

      case 'linked-pages': {
        const res = await fetch(url, { redirect: 'follow' });
        const html = await res.text();
        const links = [...html.matchAll(/href="(https?:\/\/[^"]+)"/g)].map(m => m[1]);
        const origin = new URL(url).origin;
        const internal = links.filter(l => l.startsWith(origin));
        const external = links.filter(l => !l.startsWith(origin));
        return { data: { internal: internal.length, external: external.length } };
      }

      case 'tech-stack': {
        const res = await fetch(url, { redirect: 'follow' });
        const html = await res.text();
        const headers: Record<string, string> = {};
        res.headers.forEach((v, k) => { headers[k] = v; });
        const techs: string[] = [];
        if (html.includes('wp-content') || html.includes('wordpress')) techs.push('WordPress');
        if (html.includes('next/') || html.includes('__next')) techs.push('Next.js');
        if (html.includes('react') || html.includes('__react')) techs.push('React');
        if (html.includes('vue') || html.includes('__vue')) techs.push('Vue.js');
        if (headers['x-powered-by']?.includes('Express')) techs.push('Express');
        if (headers['server']?.includes('nginx')) techs.push('nginx');
        if (headers['server']?.includes('cloudflare')) techs.push('Cloudflare');
        return { data: { technologies: techs } };
      }

      case 'archives': {
        const hostname = new URL(url).hostname;
        const res = await fetch(
          `https://web.archive.org/cdx/search/cdx?url=${hostname}&output=json&limit=1&fl=timestamp`,
        );
        if (!res.ok) return { data: { found: false } };
        const json = await res.json() as string[][];
        return { data: { found: json.length > 1, firstArchive: json[1]?.[0] ?? null } };
      }

      case 'carbon': {
        const hostname = new URL(url).hostname;
        const res = await fetch(`https://api.websitecarbon.com/site?url=${encodeURIComponent(hostname)}`);
        if (!res.ok) return { error: 'Carbon API unavailable' };
        const data = await res.json();
        return { data };
      }

      case 'tls': {
        const hostname = new URL(url).hostname;
        const res = await fetch(`https://tls-observatory.services.mozilla.com/api/v1/scan?target=${hostname}`);
        if (!res.ok) return { error: 'Mozilla Observatory unavailable' };
        const data = await res.json();
        return { data };
      }

      case 'dnssec': {
        const hostname = new URL(url).hostname;
        const res = await fetch(`https://dns.google/resolve?name=${hostname}&type=DNSKEY`);
        if (!res.ok) return { error: 'Google DoH unavailable' };
        const data = await res.json();
        return { data };
      }

      default:
        return { skipped: `Handler "${name}" is not available in light mode` };
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export const onRequestGet: PagesFunction = async ({ request }) => {
  const url = new URL(request.url);
  const pathParts = url.pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean);
  const targetUrl = url.searchParams.get('url');

  // GET /api — run all light handlers
  if (pathParts.length === 0) {
    if (!targetUrl) {
      return new Response(JSON.stringify({ error: 'Missing "url" query parameter' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const results: Record<string, HandlerResult> = {};
    const promises = [...LIGHT_HANDLERS].map(async (name) => {
      results[name] = await runLightHandler(name, targetUrl);
    });
    await Promise.all(promises);

    // Add skipped entries for non-light handlers
    const fullOnlyHandlers = [
      'dns', 'dns-server', 'txt-records', 'mail-config', 'ssl', 'firewall',
      'threats', 'block-lists', 'ports', 'get-ip', 'trace-route', 'whois',
      'rank', 'legacy-rank', 'quality', 'features', 'screenshot',
    ];
    for (const name of fullOnlyHandlers) {
      results[name] = { skipped: 'Not available in light mode — use Docker full scan' };
    }

    return new Response(JSON.stringify({ results }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // GET /api/{handler} — run single handler
  const handlerName = pathParts[0];
  if (!targetUrl) {
    return new Response(JSON.stringify({ error: 'Missing "url" query parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!LIGHT_HANDLERS.has(handlerName)) {
    return new Response(
      JSON.stringify({ skipped: `Handler "${handlerName}" is not available in light mode` }),
      { headers: { 'Content-Type': 'application/json' } },
    );
  }

  const result = await runLightHandler(handlerName, targetUrl);
  return new Response(JSON.stringify(result), {
    headers: { 'Content-Type': 'application/json' },
  });
};
