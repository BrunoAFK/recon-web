import { registry, getPresentationMetadata } from '@recon-web/core';
import type { HandlerResult, HandlerCategory } from '@recon-web/core';
import type { ScanWithResults } from '../db/index.js';
import { reportStyles } from './styles.js';
import { extractIssues } from './issues.js';
import { renderHandlerData } from './render-handler.js';

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getDisplayName(handler: string): string {
  return getPresentationMetadata(handler)?.displayName ?? registry[handler]?.metadata.name ?? handler;
}

const CATEGORY_ORDER: HandlerCategory[] = ['security', 'dns', 'network', 'content', 'meta', 'performance'];

export function generateReportHtml(scan: ScanWithResults): string {
  // Build results map
  const results: Record<string, HandlerResult> = {};
  for (const r of scan.results) {
    results[r.handler] = r.result as HandlerResult;
  }

  const totalHandlers = scan.results.length;
  const successCount = scan.results.filter((r) => {
    const res = r.result as HandlerResult;
    return res.data && !res.error;
  }).length;
  const errorCount = scan.results.filter((r) => (r.result as HandlerResult).error).length;
  const skippedCount = scan.results.filter((r) => (r.result as HandlerResult).skipped).length;

  // Extract issues
  const issues = extractIssues(results, getDisplayName);
  const criticalCount = issues.filter((i) => i.severity === 'critical').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;

  // Group results by category
  const byCategory: Record<string, Array<{ handler: string; result: HandlerResult }>> = {};
  for (const r of scan.results) {
    const meta = registry[r.handler]?.metadata;
    const cat = meta?.category ?? 'meta';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push({ handler: r.handler, result: r.result as HandlerResult });
  }

  const duration = scan.duration_ms != null ? `${(scan.duration_ms / 1000).toFixed(1)}s` : 'N/A';
  const scanDate = new Date(scan.created_at).toLocaleString();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Security Report — ${esc(scan.url)}</title>
  <style>${reportStyles}</style>
</head>
<body>
<div class="container">

  <!-- Header -->
  <div class="header">
    <h1>recon-web Security Report</h1>
    <div class="url">${esc(scan.url)}</div>
    <div class="meta">
      <span>Scanned: ${esc(scanDate)}</span>
      <span>Duration: ${esc(duration)}</span>
      <span>Scan ID: ${esc(scan.id)}</span>
    </div>
  </div>

  <!-- Summary -->
  <div class="summary">
    <div class="stat-card total"><div class="value">${totalHandlers}</div><div class="label">Total Checks</div></div>
    <div class="stat-card ok"><div class="value">${successCount}</div><div class="label">Passed</div></div>
    <div class="stat-card errors"><div class="value">${errorCount}</div><div class="label">Errors</div></div>
    <div class="stat-card"><div class="value">${skippedCount}</div><div class="label">Skipped</div></div>
  </div>

  <!-- Executive Summary -->
  <div class="issues">
    <h2>Issues Found (${issues.filter((i) => i.severity !== 'info').length})</h2>
    ${criticalCount > 0 ? `<p style="margin-bottom:12px;color:#dc2626;font-weight:600;">${criticalCount} critical issue${criticalCount > 1 ? 's' : ''} require immediate attention.</p>` : ''}
    ${warningCount > 0 ? `<p style="margin-bottom:12px;color:#f59e0b;font-weight:600;">${warningCount} warning${warningCount > 1 ? 's' : ''} should be reviewed.</p>` : ''}
    ${criticalCount === 0 && warningCount === 0 ? '<p style="margin-bottom:12px;color:#16a34a;font-weight:600;">No critical issues or warnings detected.</p>' : ''}

    ${issues.filter((i) => i.severity !== 'info').map((issue) => `
    <div class="issue ${issue.severity}">
      <div class="issue-header">
        <span class="severity-badge ${issue.severity}">${issue.severity}</span>
        <span class="handler-name">${esc(issue.displayName)}</span>
      </div>
      <div class="message">${esc(issue.message)}</div>
      <div class="recommendation">${esc(issue.recommendation)}</div>
    </div>
    `).join('')}
  </div>

  <!-- Results by Category -->
  ${CATEGORY_ORDER.map((cat) => {
    const items = byCategory[cat];
    if (!items || items.length === 0) return '';

    return `
  <div class="category">
    <h2>${esc(cat)} (${items.length})</h2>
    ${items.map(({ handler, result }) => {
      const displayName = getDisplayName(handler);
      const description = registry[handler]?.metadata.description ?? '';
      const status = result.error ? 'fail' : result.skipped ? 'skip' : 'pass';

      return `
    <div class="handler-card">
      <div class="handler-header">
        <span class="status-dot ${status}"></span>
        <h3>${esc(displayName)}</h3>
      </div>
      <div class="description">${esc(description)}</div>
      <div class="handler-data">
        ${renderHandlerData(handler, result)}
      </div>
    </div>`;
    }).join('')}
  </div>`;
  }).join('')}

  <!-- Footer -->
  <div class="footer">
    Generated by recon-web &middot; ${esc(new Date().toISOString())}
  </div>

</div>
</body>
</html>`;
}
