import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import cron from 'node-cron';
import { executeScan } from '../scan.js';
import { detectChanges } from '@recon-web/core';
import { buildNotificationConfig, sendNotification } from '../notifications/index.js';

async function schedulerPluginImpl(app: FastifyInstance): Promise<void> {
  const enabled = process.env.SCHEDULE_ENABLED === 'true';
  const urlsRaw = process.env.SCHEDULE_URLS ?? '';
  const cronExpr = process.env.SCHEDULE_CRON ?? '0 0 * * *';

  if (!enabled) {
    app.log.info('Scheduler plugin loaded but SCHEDULE_ENABLED is not true — skipping');
    return;
  }

  const urls = urlsRaw
    .split(',')
    .map((u) => u.trim())
    .filter(Boolean);

  if (urls.length === 0) {
    app.log.warn('Scheduler enabled but SCHEDULE_URLS is empty — nothing to scan');
    return;
  }

  if (!cron.validate(cronExpr)) {
    app.log.error(`Invalid cron expression: ${cronExpr}`);
    return;
  }

  app.log.info(`Scheduler started: ${urls.length} URL(s), cron="${cronExpr}"`);

  const task = cron.schedule(cronExpr, async () => {
    app.log.info('Scheduled scan triggered');

    const db = app.db;
    const notifyConfig = buildNotificationConfig();

    for (const url of urls) {
      try {
        app.log.info(`Scanning ${url}...`);
        const { scanId, results } = await executeScan({
          db,
          url,
          handlerOptions: { timeout: 30_000 },
          concurrency: 4,
        });

        const errorCount = Object.values(results).filter((r) => r.error).length;
        app.log.info(`Scan complete for ${url}: ${Object.keys(results).length} handlers, ${errorCount} errors`);

        // Change detection + notifications
        try {
          // Get previous scan for this URL (the one before the current)
          const prevStmt = db.prepare(
            'SELECT id FROM scans WHERE url = ? AND id != ? ORDER BY created_at DESC LIMIT 1',
          );
          const prevRow = prevStmt.get(url, scanId) as { id: string } | undefined;

          if (prevRow) {
            const prevResults: Record<string, { data?: unknown; error?: string }> = {};
            const prevRows = db.prepare('SELECT handler, result FROM scan_results WHERE scan_id = ?').all(prevRow.id) as Array<{ handler: string; result: string }>;
            for (const r of prevRows) {
              try {
                prevResults[r.handler] = JSON.parse(r.result);
              } catch {
                prevResults[r.handler] = { error: 'Corrupted result data' };
              }
            }

            const changes = detectChanges(prevResults, results);
            if (changes.length > 0) {
              app.log.info(`${changes.length} changes detected for ${url}`);
              await sendNotification(changes, notifyConfig, app.log);
            }
          }
        } catch (diffErr) {
          app.log.error(`Change detection failed for ${url}: ${String(diffErr)}`);
        }
      } catch (err) {
        app.log.error(`Scheduled scan failed for ${url}: ${String(err)}`);
      }
    }
  });

  app.addHook('onClose', () => {
    task.stop();
    app.log.info('Scheduler stopped');
  });
}

export const schedulerPlugin = fp(schedulerPluginImpl, {
  name: 'scheduler-plugin',
  fastify: '5.x',
});
