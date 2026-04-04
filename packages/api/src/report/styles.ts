export const reportStyles = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: #1a1a2e;
    background: #fff;
    line-height: 1.6;
    font-size: 14px;
  }
  .container { max-width: 900px; margin: 0 auto; padding: 40px 32px; }

  /* Header */
  .header {
    border-bottom: 3px solid #2563eb;
    padding-bottom: 24px;
    margin-bottom: 32px;
  }
  .header h1 {
    font-size: 28px;
    font-weight: 700;
    color: #2563eb;
    margin-bottom: 4px;
  }
  .header .url {
    font-size: 18px;
    color: #334155;
    word-break: break-all;
  }
  .header .meta {
    display: flex;
    gap: 24px;
    margin-top: 12px;
    font-size: 13px;
    color: #64748b;
  }

  /* Summary */
  .summary {
    display: flex;
    gap: 16px;
    margin-bottom: 32px;
    flex-wrap: wrap;
  }
  .stat-card {
    flex: 1;
    min-width: 120px;
    padding: 16px;
    border-radius: 8px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    text-align: center;
  }
  .stat-card .value {
    font-size: 24px;
    font-weight: 700;
  }
  .stat-card .label {
    font-size: 12px;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .stat-card.ok .value { color: #16a34a; }
  .stat-card.errors .value { color: #dc2626; }
  .stat-card.total .value { color: #2563eb; }

  /* Issues */
  .issues { margin-bottom: 40px; }
  .issues h2 {
    font-size: 20px;
    font-weight: 700;
    margin-bottom: 16px;
    padding-bottom: 8px;
    border-bottom: 1px solid #e2e8f0;
  }
  .issue {
    padding: 14px 16px;
    border-radius: 8px;
    margin-bottom: 10px;
    border-left: 4px solid;
  }
  .issue.critical {
    background: #fef2f2;
    border-left-color: #dc2626;
  }
  .issue.warning {
    background: #fffbeb;
    border-left-color: #f59e0b;
  }
  .issue.info {
    background: #f0f9ff;
    border-left-color: #3b82f6;
  }
  .issue .issue-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
  }
  .issue .severity-badge {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    padding: 2px 8px;
    border-radius: 4px;
    color: #fff;
  }
  .severity-badge.critical { background: #dc2626; }
  .severity-badge.warning { background: #f59e0b; }
  .severity-badge.info { background: #3b82f6; }
  .issue .handler-name {
    font-weight: 600;
    font-size: 14px;
  }
  .issue .message { color: #334155; margin-bottom: 4px; }
  .issue .recommendation {
    font-size: 13px;
    color: #64748b;
    font-style: italic;
  }

  /* Category sections */
  .category {
    margin-bottom: 32px;
    page-break-inside: avoid;
  }
  .category h2 {
    font-size: 18px;
    font-weight: 700;
    margin-bottom: 12px;
    padding-bottom: 6px;
    border-bottom: 2px solid #e2e8f0;
    text-transform: capitalize;
  }
  .handler-card {
    padding: 12px 16px;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    margin-bottom: 8px;
    page-break-inside: avoid;
  }
  .handler-card .handler-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
  }
  .handler-card .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    display: inline-block;
  }
  .status-dot.pass { background: #16a34a; }
  .status-dot.fail { background: #dc2626; }
  .status-dot.skip { background: #94a3b8; }
  .handler-card h3 {
    font-size: 14px;
    font-weight: 600;
  }
  .handler-card .description {
    font-size: 12px;
    color: #64748b;
  }
  .handler-data {
    font-size: 13px;
    margin-top: 8px;
  }
  .handler-data table {
    width: 100%;
    border-collapse: collapse;
  }
  .handler-data td, .handler-data th {
    padding: 4px 8px;
    border-bottom: 1px solid #f1f5f9;
    text-align: left;
    font-size: 13px;
    vertical-align: top;
  }
  .handler-data td:first-child {
    font-weight: 500;
    color: #475569;
    white-space: nowrap;
    width: 160px;
  }
  .handler-data .error-text { color: #dc2626; }
  .handler-data .skip-text { color: #94a3b8; font-style: italic; }

  /* Footer */
  .footer {
    margin-top: 48px;
    padding-top: 16px;
    border-top: 1px solid #e2e8f0;
    font-size: 12px;
    color: #94a3b8;
    text-align: center;
  }

  /* Print styles */
  @media print {
    body { font-size: 12px; }
    .container { padding: 20px; }
    .header { page-break-after: avoid; }
    .category { page-break-inside: avoid; }
    .handler-card { page-break-inside: avoid; }
  }
`;
