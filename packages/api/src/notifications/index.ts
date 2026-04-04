import type { Change } from '@recon-web/core';
import { sendTelegram } from './telegram.js';
import { sendEmail } from './email.js';

export interface NotificationConfig {
  telegram?: {
    botToken: string;
    chatId: string;
  };
  email?: {
    smtpHost: string;
    smtpPort: number;
    smtpUser: string;
    smtpPass: string;
    to: string;
  };
}

/**
 * Build a notification config from environment variables.
 * Only channels with all required fields populated are included.
 */
export function buildNotificationConfig(): NotificationConfig {
  const cfg: NotificationConfig = {};

  const botToken = process.env.TELEGRAM_BOT_TOKEN ?? '';
  const chatId = process.env.TELEGRAM_CHAT_ID ?? '';
  if (botToken && chatId) {
    cfg.telegram = { botToken, chatId };
  }

  const smtpHost = process.env.SMTP_HOST ?? '';
  const smtpPort = parseInt(process.env.SMTP_PORT ?? '587', 10);
  const smtpUser = process.env.SMTP_USER ?? '';
  const smtpPass = process.env.SMTP_PASS ?? '';
  const notifyEmail = process.env.NOTIFY_EMAIL ?? '';
  if (smtpHost && smtpUser && smtpPass && notifyEmail) {
    cfg.email = { smtpHost, smtpPort, smtpUser, smtpPass, to: notifyEmail };
  }

  return cfg;
}

/** Format changes into a human-readable text message. */
export function formatChanges(changes: Change[]): string {
  if (changes.length === 0) return 'No changes detected.';

  const lines = ['recon-web: Changes detected\n'];

  for (const c of changes) {
    const icon = c.severity === 'critical' ? '[!!!]' : c.severity === 'warning' ? '[!]' : '[i]';
    lines.push(`${icon} ${c.handler} / ${c.field}`);
    lines.push(`    was: ${stringify(c.oldValue)}`);
    lines.push(`    now: ${stringify(c.newValue)}`);
    lines.push('');
  }

  return lines.join('\n');
}

function stringify(v: unknown): string {
  if (v === null || v === undefined) return '(none)';
  if (typeof v === 'string') return v;
  return JSON.stringify(v);
}

/**
 * Dispatch change notifications to all enabled channels.
 */
export async function sendNotification(
  changes: Change[],
  config: NotificationConfig,
  logger?: { error: (msg: string) => void },
): Promise<void> {
  if (changes.length === 0) return;

  const message = formatChanges(changes);

  const promises: Promise<void>[] = [];

  if (config.telegram) {
    promises.push(sendTelegram(message, config.telegram));
  }

  if (config.email) {
    promises.push(sendEmail(message, config.email));
  }

  const results = await Promise.allSettled(promises);
  for (const r of results) {
    if (r.status === 'rejected') {
      logger?.error(`Notification failed: ${String(r.reason)}`);
    }
  }
}
