import type { HandlerResult } from '@recon-web/core';

export type IssueSeverity = 'critical' | 'warning' | 'info';

export interface Issue {
  handler: string;
  displayName: string;
  severity: IssueSeverity;
  message: string;
  recommendation: string;
}

const SEVERITY_ORDER: Record<IssueSeverity, number> = { critical: 0, warning: 1, info: 2 };

export function extractIssues(
  results: Record<string, HandlerResult>,
  getDisplayName: (name: string) => string,
): Issue[] {
  const issues: Issue[] = [];

  for (const [handler, result] of Object.entries(results)) {
    const displayName = getDisplayName(handler);

    // Skipped handlers
    if (result.skipped) {
      issues.push({
        handler,
        displayName,
        severity: 'info',
        message: result.skipped,
        recommendation: 'Configure the required API key or runtime dependency to enable this check.',
      });
      continue;
    }

    // Error handlers
    if (result.error) {
      const issue = classifyError(handler, displayName, result.error);
      if (issue) issues.push(issue);
      continue;
    }

    // Data-based issues
    const dataIssues = classifyData(handler, displayName, result.data);
    issues.push(...dataIssues);
  }

  issues.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  return issues;
}

function classifyError(handler: string, displayName: string, error: string): Issue | null {
  if (handler === 'ssl') {
    return {
      handler, displayName, severity: 'critical',
      message: `SSL certificate check failed: ${error}`,
      recommendation: 'Ensure the SSL certificate is valid and properly installed. Check certificate chain and expiration.',
    };
  }
  if (handler === 'threats') {
    return {
      handler, displayName, severity: 'warning',
      message: `Threat intelligence check failed: ${error}`,
      recommendation: 'Verify the target URL is accessible and check API key configuration.',
    };
  }
  return {
    handler, displayName, severity: 'warning',
    message: `Check failed: ${error}`,
    recommendation: 'Review the error and ensure the target is reachable.',
  };
}

function classifyData(handler: string, displayName: string, data: unknown): Issue[] {
  const issues: Issue[] = [];
  if (!data || typeof data !== 'object') return issues;

  const d = data as Record<string, unknown>;

  switch (handler) {
    case 'ssl': {
      const validTo = d.validTo as string | undefined;
      if (validTo) {
        const daysLeft = Math.floor((new Date(validTo).getTime() - Date.now()) / 86_400_000);
        if (daysLeft < 0) {
          issues.push({
            handler, displayName, severity: 'critical',
            message: `SSL certificate expired ${Math.abs(daysLeft)} days ago.`,
            recommendation: 'Renew your SSL certificate immediately. If using Let\'s Encrypt, run `certbot renew`.',
          });
        } else if (daysLeft < 30) {
          issues.push({
            handler, displayName, severity: 'warning',
            message: `SSL certificate expires in ${daysLeft} days.`,
            recommendation: 'Renew your SSL certificate soon to avoid downtime.',
          });
        }
      }
      break;
    }

    case 'http-security': {
      const score = d.score as number | undefined;
      if (score !== undefined) {
        if (score < 50) {
          issues.push({
            handler, displayName, severity: 'critical',
            message: `Security headers score is ${score}/100.`,
            recommendation: 'Add security headers: Content-Security-Policy, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy.',
          });
        } else if (score < 80) {
          issues.push({
            handler, displayName, severity: 'warning',
            message: `Security headers score is ${score}/100.`,
            recommendation: 'Review and strengthen your Content-Security-Policy and other security headers.',
          });
        }
      }
      break;
    }

    case 'hsts': {
      const enabled = d.enabled ?? d.hasHsts ?? d.preloaded;
      if (!enabled) {
        issues.push({
          handler, displayName, severity: 'warning',
          message: 'HSTS is not enabled.',
          recommendation: 'Add Strict-Transport-Security header: `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`.',
        });
      }
      break;
    }

    case 'dnssec': {
      const enabled = d.enabled ?? d.isValid;
      if (enabled === false) {
        issues.push({
          handler, displayName, severity: 'warning',
          message: 'DNSSEC is not enabled.',
          recommendation: 'Enable DNSSEC through your domain registrar or DNS provider.',
        });
      }
      break;
    }

    case 'threats': {
      const safeBrowsing = d.safeBrowsing as Record<string, unknown> | undefined;
      if (safeBrowsing?.unsafe === true) {
        issues.push({
          handler, displayName, severity: 'critical',
          message: 'Google Safe Browsing flagged this site as unsafe.',
          recommendation: 'Review and remove malicious content. Submit a review request via Google Search Console.',
        });
      }
      break;
    }

    case 'ports': {
      const openPorts = d.openPorts as number[] | undefined;
      if (openPorts) {
        const sensitive = openPorts.filter((p) => [22, 3306, 5432, 3389, 5900].includes(p));
        if (sensitive.length > 0) {
          issues.push({
            handler, displayName, severity: 'warning',
            message: `Sensitive ports exposed: ${sensitive.join(', ')}.`,
            recommendation: 'Restrict access to these ports via firewall rules. Use a VPN for remote access.',
          });
        }
      }
      break;
    }

    case 'security-txt': {
      // If data has no meaningful content, security.txt is likely missing
      const hasContact = d.contact || d.Contact;
      if (!hasContact && !d.content) {
        issues.push({
          handler, displayName, severity: 'info',
          message: 'No security.txt file found.',
          recommendation: 'Create a security.txt file at /.well-known/security.txt with contact info for vulnerability reporters.',
        });
      }
      break;
    }
  }

  return issues;
}
