import pc from 'picocolors';
import type { HandlerResult, HandlerMetadata } from '@recon-web/core';

// ── JUnit output ────────────────────────────────────────────

export function formatJunit(
  url: string,
  results: Record<string, HandlerResult>,
  durationMs: number,
): string {
  const entries = Object.entries(results);
  const failures = entries.filter(([, r]) => r.error).length;
  const skipped = entries.filter(([, r]) => r.skipped).length;
  const seconds = (durationMs / 1000).toFixed(3);

  const testcases = entries.map(([name, result]) => {
    if (result.error) {
      return `    <testcase name="${esc(name)}" classname="recon-web" time="0">\n      <failure message="${esc(result.error)}" />\n    </testcase>`;
    }
    if (result.skipped) {
      return `    <testcase name="${esc(name)}" classname="recon-web" time="0">\n      <skipped message="${esc(result.skipped)}" />\n    </testcase>`;
    }
    return `    <testcase name="${esc(name)}" classname="recon-web" time="0" />`;
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<testsuites>`,
    `  <testsuite name="recon-web" tests="${entries.length}" failures="${failures}" skipped="${skipped}" time="${seconds}" timestamp="${new Date().toISOString()}">`,
    `    <properties>`,
    `      <property name="url" value="${esc(url)}" />`,
    `    </properties>`,
    ...testcases,
    `  </testsuite>`,
    `</testsuites>`,
  ].join('\n');
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Threshold checks ────────────────────────────────────────

export interface ThresholdResult {
  passed: boolean;
  rule: string;
  message: string;
}

export function checkThresholds(
  rules: string[],
  results: Record<string, HandlerResult>,
): ThresholdResult[] {
  return rules.map((rule) => {
    // Format: handler:condition:value  e.g. "ssl:expired" or "security-score:below:80"
    const parts = rule.split(':');
    if (parts.length < 2) {
      return { passed: true, rule, message: `Invalid rule format: ${rule}` };
    }

    const [handler, condition, value] = parts;
    const result = results[handler];

    if (!result) {
      return { passed: false, rule, message: `Handler "${handler}" not found in results` };
    }
    if (result.error) {
      return { passed: false, rule, message: `Handler "${handler}" failed: ${result.error}` };
    }
    if (result.skipped) {
      return { passed: true, rule, message: `Handler "${handler}" was skipped` };
    }

    const data = result.data as Record<string, unknown> | undefined;
    if (!data) {
      return { passed: false, rule, message: `Handler "${handler}" returned no data` };
    }

    switch (condition) {
      case 'expired': {
        // Check if SSL certificate is expired
        const validTo = data.validTo as string | undefined;
        if (validTo && new Date(validTo) < new Date()) {
          return { passed: false, rule, message: `SSL certificate expired: ${validTo}` };
        }
        return { passed: true, rule, message: 'SSL certificate valid' };
      }
      case 'below': {
        const threshold = Number(value);
        const score = typeof data.score === 'number' ? data.score : Number(data.score);
        if (isNaN(score)) {
          return { passed: true, rule, message: `No numeric score found for "${handler}"` };
        }
        if (score < threshold) {
          return { passed: false, rule, message: `${handler} score ${score} below threshold ${threshold}` };
        }
        return { passed: true, rule, message: `${handler} score ${score} >= ${threshold}` };
      }
      case 'missing': {
        // Check if a specific field is missing/empty
        const field = value;
        if (field && !data[field]) {
          return { passed: false, rule, message: `Field "${field}" missing in ${handler}` };
        }
        return { passed: true, rule, message: `Field "${value}" present in ${handler}` };
      }
      default:
        return { passed: true, rule, message: `Unknown condition: ${condition}` };
    }
  });
}

// ── Diff ────────────────────────────────────────────────────

export interface DiffEntry {
  handler: string;
  type: 'added' | 'removed' | 'changed';
  detail: string;
}

export function diffResults(
  oldResults: Record<string, HandlerResult>,
  newResults: Record<string, HandlerResult>,
): DiffEntry[] {
  const diffs: DiffEntry[] = [];
  const allHandlers = new Set([...Object.keys(oldResults), ...Object.keys(newResults)]);

  for (const handler of allHandlers) {
    const oldR = oldResults[handler];
    const newR = newResults[handler];

    if (!oldR && newR) {
      diffs.push({ handler, type: 'added', detail: 'New handler result' });
      continue;
    }
    if (oldR && !newR) {
      diffs.push({ handler, type: 'removed', detail: 'Handler result removed' });
      continue;
    }
    if (!oldR || !newR) continue;

    // Compare error/skipped status changes
    if (oldR.error !== newR.error) {
      diffs.push({ handler, type: 'changed', detail: `error: "${oldR.error ?? 'none'}" → "${newR.error ?? 'none'}"` });
    }
    if (oldR.skipped !== newR.skipped) {
      diffs.push({ handler, type: 'changed', detail: `skipped: "${oldR.skipped ?? 'none'}" → "${newR.skipped ?? 'none'}"` });
    }

    // Shallow data comparison
    const oldJson = JSON.stringify(oldR.data ?? null);
    const newJson = JSON.stringify(newR.data ?? null);
    if (oldJson !== newJson) {
      diffs.push({ handler, type: 'changed', detail: 'Data changed' });
    }
  }

  return diffs;
}

const CATEGORY_COLORS: Record<string, (s: string) => string> = {
  dns: pc.cyan,
  security: pc.red,
  network: pc.yellow,
  content: pc.green,
  performance: pc.magenta,
  meta: pc.blue,
};

export function formatCategoryBadge(category: string): string {
  const colorFn = CATEGORY_COLORS[category] || pc.gray;
  return colorFn(`[${category}]`);
}

export function formatHandlerResult(
  name: string,
  metadata: HandlerMetadata,
  result: HandlerResult,
  verbose: boolean,
): string {
  const badge = formatCategoryBadge(metadata.category);
  const label = pc.bold(name);

  if (result.error) {
    return `${badge} ${label} ${pc.red('✗')} ${pc.dim(result.error)}`;
  }

  if (result.skipped) {
    return `${badge} ${label} ${pc.yellow('⊘')} ${pc.dim(result.skipped)}`;
  }

  if (!result.data) {
    return `${badge} ${label} ${pc.dim('no data')}`;
  }

  const summary = summarizeData(name, result.data, verbose);
  return `${badge} ${label} ${pc.green('✓')}\n${indent(summary)}`;
}

function summarizeData(name: string, data: unknown, verbose: boolean): string {
  if (verbose) {
    return formatValue(data, 1);
  }

  // Handler-specific compact summaries
  if (typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>;

    switch (name) {
      case 'get-ip':
        return `${obj.ip} (IPv${obj.family})`;

      case 'status':
        return `${obj.statusCode} ${obj.statusMessage || ''} — ${obj.responseTime}ms`.trim();

      case 'ssl': {
        const subj = obj.subject as Record<string, unknown> | undefined;
        const cn = subj?.CN || subj?.O || 'unknown';
        return `CN=${cn}, valid: ${obj.validFrom} → ${obj.validTo}`;
      }

      case 'dns': {
        const parts: string[] = [];
        for (const [type, val] of Object.entries(obj)) {
          if (val && (!Array.isArray(val) || val.length > 0)) {
            parts.push(`${pc.dim(type)}: ${Array.isArray(val) ? val.length + ' records' : '1 record'}`);
          }
        }
        return parts.join(', ');
      }

      case 'headers':
        return Object.entries(obj)
          .slice(0, 8)
          .map(([k, v]) => `${pc.dim(k)}: ${v}`)
          .join('\n');

      case 'tech-stack':
        if (Array.isArray(obj.technologies)) {
          return (obj.technologies as Array<Record<string, unknown>>)
            .map((t) => `${t.name} ${pc.dim(`(${t.confidence}%)`)}`)
            .join(', ');
        }
        break;

      case 'firewall':
        if (obj.hasWaf) {
          return `WAF detected: ${obj.waf}`;
        }
        return pc.dim('No WAF detected');

      case 'ports':
        if (Array.isArray(obj.openPorts)) {
          return (obj.openPorts as Array<Record<string, unknown>>)
            .map((p) => `${p.port}/${p.service}`)
            .join(', ') || pc.dim('No open ports');
        }
        break;

      case 'carbon':
        return `${obj.cleanerThan ? `Cleaner than ${Math.round(Number(obj.cleanerThan) * 100)}% of sites` : 'Carbon data available'}`;

      case 'whois': {
        const parts: string[] = [];
        if (obj.registrar) parts.push(`Registrar: ${obj.registrar}`);
        if (obj.creationDate) parts.push(`Created: ${obj.creationDate}`);
        if (obj.expiryDate) parts.push(`Expires: ${obj.expiryDate}`);
        return parts.join(', ') || formatValue(data, 1);
      }
    }

    // Generic fallback: show keys and types
    const keys = Object.keys(obj);
    if (keys.length <= 5) {
      return keys.map((k) => {
        const v = obj[k];
        if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
          return `${pc.dim(k)}: ${v}`;
        }
        if (Array.isArray(v)) {
          return `${pc.dim(k)}: ${v.length} items`;
        }
        return `${pc.dim(k)}: [object]`;
      }).join('\n');
    }
    return `${keys.length} fields: ${keys.join(', ')}`;
  }

  return String(data);
}

function formatValue(value: unknown, depth: number): string {
  const prefix = '  '.repeat(depth);
  if (value === null || value === undefined) return pc.dim('null');
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);

  if (Array.isArray(value)) {
    if (value.length === 0) return pc.dim('[]');
    return value.map((v) => `${prefix}- ${formatValue(v, depth + 1)}`).join('\n');
  }

  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => `${prefix}${pc.dim(k)}: ${formatValue(v, depth + 1)}`)
      .join('\n');
  }

  return String(value);
}

function indent(text: string): string {
  return text
    .split('\n')
    .map((line) => `  ${line}`)
    .join('\n');
}

export function formatSeparator(): string {
  return pc.dim('─'.repeat(60));
}

export function formatHeader(url: string): string {
  return [
    '',
    pc.bold(pc.cyan('  recon-web')),
    pc.dim(`  Scanning ${url}`),
    formatSeparator(),
  ].join('\n');
}

export function formatSummary(
  total: number,
  succeeded: number,
  failed: number,
  skipped: number,
  durationMs: number,
): string {
  const seconds = (durationMs / 1000).toFixed(1);
  return [
    formatSeparator(),
    `  ${pc.green(`${succeeded} passed`)}  ${failed > 0 ? pc.red(`${failed} failed`) : ''}  ${skipped > 0 ? pc.yellow(`${skipped} skipped`) : ''}  ${pc.dim(`(${total} total, ${seconds}s)`)}`,
    '',
  ].join('\n');
}
