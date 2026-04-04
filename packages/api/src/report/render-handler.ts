import type { HandlerResult } from '@recon-web/core';

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function kvRow(label: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  return `<tr><td>${esc(label)}</td><td>${esc(value)}</td></tr>`;
}

function renderObject(data: Record<string, unknown>, maxKeys = 20): string {
  const keys = Object.keys(data).slice(0, maxKeys);
  if (keys.length === 0) return '<p class="skip-text">No data</p>';

  const rows = keys.map((key) => {
    const val = data[key];
    if (val === null || val === undefined) return '';
    const label = key.replace(/([A-Z])/g, ' $1').replace(/[_-]/g, ' ').trim();
    if (typeof val === 'object' && !Array.isArray(val)) {
      return kvRow(label, JSON.stringify(val));
    }
    if (Array.isArray(val)) {
      return kvRow(label, val.length > 5 ? `${val.slice(0, 5).join(', ')} (+${val.length - 5} more)` : val.join(', '));
    }
    return kvRow(label, val);
  }).filter(Boolean);

  if (rows.length === 0) return '<p class="skip-text">No data</p>';
  return `<table>${rows.join('')}</table>`;
}

// Custom renderers for specific handlers

function renderSsl(data: Record<string, unknown>): string {
  return `<table>
    ${kvRow('Subject', data.subject)}
    ${kvRow('Issuer', data.issuer)}
    ${kvRow('Valid From', data.validFrom)}
    ${kvRow('Valid To', data.validTo)}
    ${kvRow('Serial Number', data.serialNumber)}
    ${kvRow('Fingerprint', data.fingerprint)}
    ${kvRow('SANs', Array.isArray(data.subjectaltname) ? (data.subjectaltname as string[]).join(', ') : data.subjectaltname)}
  </table>`;
}

function renderPorts(data: Record<string, unknown>): string {
  const open = data.openPorts as number[] | undefined;
  const failed = data.failedPorts as number[] | undefined;
  return `<table>
    ${kvRow('Open Ports', open?.length ? open.join(', ') : 'None')}
    ${kvRow('Closed/Filtered', failed?.length ? `${failed.length} ports` : 'None')}
  </table>`;
}

function renderTechStack(data: Record<string, unknown>): string {
  const techs = data.technologies as Array<{ name: string; category?: string; confidence?: number }> | undefined;
  if (!techs || techs.length === 0) return '<p class="skip-text">No technologies detected</p>';
  const rows = techs.slice(0, 20).map((t) =>
    `<tr><td>${esc(t.name)}</td><td>${esc(t.category ?? '-')}</td><td>${t.confidence ?? '-'}%</td></tr>`
  );
  return `<table><tr><th>Technology</th><th>Category</th><th>Confidence</th></tr>${rows.join('')}</table>`;
}

function renderHttpSecurity(data: Record<string, unknown>): string {
  const score = data.score;
  const headers = data.headers as Record<string, unknown> | undefined;
  let html = '';
  if (score !== undefined) {
    html += `<p><strong>Score: ${esc(score)}/100</strong></p>`;
  }
  if (headers && typeof headers === 'object') {
    html += renderObject(headers);
  }
  return html || renderObject(data);
}

const CUSTOM_RENDERERS: Record<string, (data: Record<string, unknown>) => string> = {
  ssl: renderSsl,
  ports: renderPorts,
  'tech-stack': renderTechStack,
  'http-security': renderHttpSecurity,
};

export function renderHandlerData(handler: string, result: HandlerResult): string {
  if (result.skipped) {
    return `<p class="skip-text">${esc(result.skipped)}</p>`;
  }

  if (result.error) {
    return `<p class="error-text">${esc(result.error)}</p>`;
  }

  const data = result.data;
  if (!data || typeof data !== 'object') {
    return data !== undefined ? `<p>${esc(data)}</p>` : '<p class="skip-text">No data returned</p>';
  }

  // Skip screenshot binary data in report
  if (handler === 'screenshot') {
    return '<p class="skip-text">Screenshot captured (not included in report)</p>';
  }

  const custom = CUSTOM_RENDERERS[handler];
  if (custom) {
    return custom(data as Record<string, unknown>);
  }

  return renderObject(data as Record<string, unknown>);
}
