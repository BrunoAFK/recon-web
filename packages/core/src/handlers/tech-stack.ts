import axios from 'axios';
import * as cheerio from 'cheerio';
import type { AnalysisHandler, HandlerResult } from '../types.js';
import { getFinalResponseUrl } from '../utils/http.js';
import { normalizeUrl } from '../utils/url.js';

interface DetectedTechnology {
  name: string;
  categories: string[];
  confidence: number;
}

export interface TechStackResult {
  technologies: DetectedTechnology[];
  message?: string;
  finalUrl?: string;
}

interface TechPattern {
  name: string;
  categories: string[];
  headers?: Record<string, RegExp>;
  meta?: Record<string, RegExp>;
  scripts?: RegExp[];
  links?: RegExp[];
  html?: RegExp[];
}

const KNOWN_TECH_PATTERNS: TechPattern[] = [
  // JavaScript frameworks
  {
    name: 'React',
    categories: ['JavaScript frameworks'],
    scripts: [/react(?:\.production|\.development)?(?:\.min)?\.js/i],
    html: [/data-react/i, /__NEXT_DATA__/i, /id="__next"/i],
  },
  {
    name: 'Next.js',
    categories: ['JavaScript frameworks'],
    html: [/__NEXT_DATA__/i, /id="__next"/i],
    meta: { generator: /Next\.js/i },
  },
  {
    name: 'Vue.js',
    categories: ['JavaScript frameworks'],
    scripts: [/vue(?:\.runtime)?(?:\.min)?\.js/i],
    html: [/data-v-[a-f0-9]/i, /id="__nuxt"/i],
  },
  {
    name: 'Nuxt.js',
    categories: ['JavaScript frameworks'],
    html: [/id="__nuxt"/i, /__NUXT__/i],
  },
  {
    name: 'Angular',
    categories: ['JavaScript frameworks'],
    scripts: [/angular(?:\.min)?\.js/i, /zone(?:\.min)?\.js/i],
    html: [/ng-version/i, /ng-app/i],
  },
  {
    name: 'jQuery',
    categories: ['JavaScript libraries'],
    scripts: [/jquery(?:\.min)?\.js/i],
  },
  {
    name: 'Bootstrap',
    categories: ['UI frameworks'],
    links: [/bootstrap(?:\.min)?\.css/i],
    scripts: [/bootstrap(?:\.min)?\.js/i],
  },
  {
    name: 'Tailwind CSS',
    categories: ['UI frameworks'],
    html: [/class="[^"]*\b(?:flex|grid|bg-|text-|p-|m-|w-|h-)\b[^"]*"/i],
  },

  // CMS
  {
    name: 'WordPress',
    categories: ['CMS'],
    meta: { generator: /WordPress/i },
    html: [/wp-content/i, /wp-includes/i],
    links: [/wp-content/i],
  },
  {
    name: 'Drupal',
    categories: ['CMS'],
    meta: { generator: /Drupal/i },
    html: [/Drupal\.settings/i, /sites\/default\/files/i],
    headers: { 'x-generator': /Drupal/i },
  },
  {
    name: 'Joomla',
    categories: ['CMS'],
    meta: { generator: /Joomla/i },
    html: [/\/media\/jui\/js\//i],
  },
  {
    name: 'Wix',
    categories: ['CMS', 'Website builders'],
    meta: { generator: /Wix/i },
    html: [/wix\.com/i, /_wixCIDX/i],
  },
  {
    name: 'Squarespace',
    categories: ['CMS', 'Website builders'],
    meta: { generator: /Squarespace/i },
    html: [/squarespace\.com/i, /Static\.SQUARESPACE/i],
  },
  {
    name: 'Shopify',
    categories: ['Ecommerce'],
    html: [/cdn\.shopify\.com/i, /Shopify\.theme/i],
    links: [/cdn\.shopify\.com/i],
  },
  {
    name: 'Ghost',
    categories: ['CMS'],
    meta: { generator: /Ghost/i },
  },
  {
    name: 'Hugo',
    categories: ['Static site generators'],
    meta: { generator: /Hugo/i },
  },
  {
    name: 'Gatsby',
    categories: ['Static site generators'],
    meta: { generator: /Gatsby/i },
    html: [/id="___gatsby"/i],
  },

  // Web servers
  {
    name: 'Nginx',
    categories: ['Web servers'],
    headers: { server: /nginx/i },
  },
  {
    name: 'Apache',
    categories: ['Web servers'],
    headers: { server: /Apache/i },
  },
  {
    name: 'Cloudflare',
    categories: ['CDN'],
    headers: { server: /cloudflare/i, 'cf-ray': /./i },
  },
  {
    name: 'Vercel',
    categories: ['PaaS'],
    headers: { server: /Vercel/i, 'x-vercel-id': /./i },
  },
  {
    name: 'Netlify',
    categories: ['PaaS'],
    headers: { server: /Netlify/i },
  },

  // Programming languages / runtimes
  {
    name: 'PHP',
    categories: ['Programming languages'],
    headers: { 'x-powered-by': /PHP/i },
  },
  {
    name: 'ASP.NET',
    categories: ['Web frameworks'],
    headers: { 'x-powered-by': /ASP\.NET/i, 'x-aspnet-version': /./i },
  },
  {
    name: 'Express',
    categories: ['Web frameworks'],
    headers: { 'x-powered-by': /Express/i },
  },

  // Analytics
  {
    name: 'Google Analytics',
    categories: ['Analytics'],
    scripts: [/google-analytics\.com\/analytics\.js/i, /googletagmanager\.com\/gtag/i],
    html: [/ga\('create'/i, /gtag\(/i],
  },
  {
    name: 'Google Tag Manager',
    categories: ['Tag managers'],
    scripts: [/googletagmanager\.com\/gtm\.js/i],
    html: [/GTM-[A-Z0-9]+/i],
  },

  // Font
  {
    name: 'Google Fonts',
    categories: ['Font scripts'],
    links: [/fonts\.googleapis\.com/i],
  },
  {
    name: 'Font Awesome',
    categories: ['Font scripts'],
    links: [/font-awesome/i, /fontawesome/i],
    scripts: [/fontawesome/i],
  },
];

export const techStackHandler: AnalysisHandler<TechStackResult> = async (url, options) => {
  try {
    const targetUrl = normalizeUrl(url);
    const response = await axios.get(targetUrl, {
      timeout: options?.timeout ?? 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; WebAnalysis/1.0)',
      },
    });
    const finalUrl = getFinalResponseUrl(response) ?? targetUrl;

    const html: string = response.data;
    const responseHeaders: Record<string, string> = {};
    for (const [key, value] of Object.entries(response.headers)) {
      if (typeof value === 'string') {
        responseHeaders[key.toLowerCase()] = value;
      }
    }

    const $ = cheerio.load(html);

    // Gather meta tags
    const metaTags: Record<string, string> = {};
    $('meta').each((_i: number, el: any) => {
      const name = $(el).attr('name') || $(el).attr('property') || '';
      const content = $(el).attr('content') || '';
      if (name && content) {
        metaTags[name.toLowerCase()] = content;
      }
    });

    // Gather script srcs
    const scriptSrcs: string[] = [];
    $('script[src]').each((_i: number, el: any) => {
      const src = $(el).attr('src');
      if (src) scriptSrcs.push(src);
    });

    // Gather link hrefs
    const linkHrefs: string[] = [];
    $('link[href]').each((_i: number, el: any) => {
      const href = $(el).attr('href');
      if (href) linkHrefs.push(href);
    });

    const fullHtml = $.html();

    const detected: DetectedTechnology[] = [];

    for (const pattern of KNOWN_TECH_PATTERNS) {
      let matched = false;
      let totalChecks = 0;
      let matchedChecks = 0;

      // Check headers
      if (pattern.headers) {
        for (const [headerName, regex] of Object.entries(pattern.headers)) {
          totalChecks++;
          const headerVal = responseHeaders[headerName.toLowerCase()];
          if (headerVal && regex.test(headerVal)) {
            matchedChecks++;
            matched = true;
          }
        }
      }

      // Check meta tags
      if (pattern.meta) {
        for (const [metaName, regex] of Object.entries(pattern.meta)) {
          totalChecks++;
          const metaVal = metaTags[metaName.toLowerCase()];
          if (metaVal && regex.test(metaVal)) {
            matchedChecks++;
            matched = true;
          }
        }
      }

      // Check scripts
      if (pattern.scripts) {
        for (const regex of pattern.scripts) {
          totalChecks++;
          if (scriptSrcs.some((src) => regex.test(src))) {
            matchedChecks++;
            matched = true;
          }
        }
      }

      // Check links
      if (pattern.links) {
        for (const regex of pattern.links) {
          totalChecks++;
          if (linkHrefs.some((href) => regex.test(href))) {
            matchedChecks++;
            matched = true;
          }
        }
      }

      // Check HTML patterns
      if (pattern.html) {
        for (const regex of pattern.html) {
          totalChecks++;
          if (regex.test(fullHtml)) {
            matchedChecks++;
            matched = true;
          }
        }
      }

      if (matched) {
        const confidence = totalChecks > 0 ? Math.round((matchedChecks / totalChecks) * 100) : 50;
        detected.push({
          name: pattern.name,
          categories: pattern.categories,
          confidence,
        });
      }
    }

    // Also check X-Powered-By for any generic value
    const poweredBy = responseHeaders['x-powered-by'];
    if (poweredBy && !detected.some((d) => d.name === poweredBy)) {
      const alreadyMatched = detected.some(
        (d) => poweredBy.toLowerCase().includes(d.name.toLowerCase()),
      );
      if (!alreadyMatched) {
        detected.push({
          name: poweredBy,
          categories: ['Web frameworks'],
          confidence: 100,
        });
      }
    }

    if (detected.length === 0) {
      return {
        data: {
          technologies: [],
          finalUrl,
          message: 'No technologies were confidently detected from the static response.',
        },
      };
    }

    return { data: { technologies: detected, finalUrl } };
  } catch (error) {
    return { error: (error as Error).message };
  }
};
