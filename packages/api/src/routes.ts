import { access, constants } from 'node:fs/promises';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { registry, getHandlerNames, getPresentationMetadata, normalizeUrl } from '@recon-web/core';
import { config, getPopulatedApiKeys } from './config.js';
import {
  getScans,
  getScan,
  deleteScan,
} from './db/index.js';
import { executeScan, executeScanDeduped, type ScanEvent } from './scan.js';
import { generateReportHtml } from './report/template.js';

const urlQuerySchema = {
  type: 'object' as const,
  required: ['url'],
  properties: {
    url: { type: 'string' as const, minLength: 1, description: 'Target URL to analyse' },
  },
};

/** Pre-handler hook that validates and normalizes the URL query parameter. */
const validateUrlHook = async (request: FastifyRequest, reply: FastifyReply) => {
  const { url } = request.query as { url: string };
  try {
    normalizeUrl(url);
  } catch (err) {
    return reply.code(400).send({ error: (err as Error).message });
  }
};

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  // ── Health check ────────────────────────────────────────────────
  app.get('/health', {
    schema: {
      description: 'Health check',
      tags: ['meta'],
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            handlers: { type: 'number' },
            uptime: { type: 'number' },
          },
        },
      },
    },
  }, async (request) => {
    const db = request.server.db;

    let dbOk = false;
    try {
      db.prepare('SELECT 1').get();
      dbOk = true;
    } catch { /* db unreachable */ }

    let chromeAvailable = false;
    if (config.chromePath) {
      try {
        await access(config.chromePath, constants.X_OK);
        chromeAvailable = true;
      } catch { /* chromium not found */ }
    }

    return {
      status: dbOk ? 'ok' : 'degraded',
      handlers: getHandlerNames().length,
      uptime: process.uptime(),
      checks: {
        database: dbOk,
        chromium: chromeAvailable,
      },
    };
  });

  // ── List handlers ───────────────────────────────────────────────
  app.get('/api/handlers', {
    schema: {
      description: 'List all available analysis handlers and their metadata',
      tags: ['meta'],
    },
  }, async () => {
    return getHandlerNames().map((name: string) => ({
      ...registry[name].metadata,
      ...getPresentationMetadata(name),
    }));
  });

  // ── Run ALL handlers ────────────────────────────────────────────
  app.get('/api', {
    schema: {
      description: 'Run all analysis handlers against the target URL',
      tags: ['analysis'],
      querystring: urlQuerySchema,
    },
    preHandler: validateUrlHook,
  }, async (request) => {
    const { url } = request.query as { url: string };
    const apiKeys = getPopulatedApiKeys();
    const db = request.server.db;

    const { scanId, results } = await executeScanDeduped({
      db,
      url,
      handlerOptions: { timeout: config.timeoutLimit, apiKeys, chromePath: config.chromePath },
      concurrency: config.maxConcurrency,
    });

    return { results, scanId };
  });

  app.get('/api/stream', {
    schema: {
      description: 'Run all analysis handlers against the target URL and stream progress updates via SSE',
      tags: ['analysis'],
      querystring: urlQuerySchema,
    },
    preHandler: validateUrlHook,
  }, async (request, reply) => {
    const { url } = request.query as { url: string };
    const apiKeys = getPopulatedApiKeys();
    const db = request.server.db;

    reply.hijack();
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    let clientConnected = true;
    const abortController = new AbortController();
    request.raw.on('close', () => {
      clientConnected = false;
      abortController.abort();
    });

    const writeEvent = (event: ScanEvent) => {
      if (!clientConnected) return;
      try {
        const payload = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
        reply.raw.write(payload);
      } catch {
        clientConnected = false;
      }
    };

    try {
      await executeScan({
        db,
        url,
        handlerOptions: { timeout: config.timeoutLimit, apiKeys, chromePath: config.chromePath },
        concurrency: config.maxConcurrency,
        onEvent: writeEvent,
        signal: abortController.signal,
      });
    } finally {
      reply.raw.end();
    }
  });

  // ── History routes ──────────────────────────────────────────────
  app.get('/api/history', {
    schema: {
      description: 'List past scans (paginated)',
      tags: ['history'],
      querystring: {
        type: 'object' as const,
        properties: {
          limit: { type: 'integer' as const, default: 20 },
          offset: { type: 'integer' as const, default: 0 },
        },
      },
    },
  }, async (request) => {
    const { limit, offset } = request.query as { limit?: number; offset?: number };
    const db = request.server.db;
    return getScans(db, { limit, offset });
  });

  app.get('/api/history/:id', {
    schema: {
      description: 'Get a single scan with all handler results',
      tags: ['history'],
      params: {
        type: 'object' as const,
        required: ['id'],
        properties: {
          id: { type: 'string' as const },
        },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const db = request.server.db;
    const scan = getScan(db, id);
    if (!scan) {
      return reply.code(404).send({ error: 'Scan not found' });
    }
    return scan;
  });

  app.delete('/api/history/:id', {
    schema: {
      description: 'Delete a scan and its results',
      tags: ['history'],
      params: {
        type: 'object' as const,
        required: ['id'],
        properties: {
          id: { type: 'string' as const },
        },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const db = request.server.db;
    const deleted = deleteScan(db, id);
    if (!deleted) {
      return reply.code(404).send({ error: 'Scan not found' });
    }
    return { success: true };
  });

  // ── Report generation ──────────────────────────────────────────
  app.get('/api/history/:id/report', {
    schema: {
      description: 'Generate an HTML or PDF report for a scan',
      tags: ['history'],
      params: {
        type: 'object' as const,
        required: ['id'],
        properties: {
          id: { type: 'string' as const },
        },
      },
      querystring: {
        type: 'object' as const,
        properties: {
          format: { type: 'string' as const, enum: ['html', 'pdf'], default: 'html' },
        },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { format } = request.query as { format?: string };
    const db = request.server.db;

    const scan = getScan(db, id);
    if (!scan) {
      return reply.code(404).send({ error: 'Scan not found' });
    }

    const html = generateReportHtml(scan);

    if (format === 'pdf') {
      if (!config.chromePath) {
        return reply.code(501).send({ error: 'PDF generation unavailable: Chromium not configured' });
      }
      // Try PDF generation via puppeteer
      const chromePath = config.chromePath;
      try {
        // @ts-ignore puppeteer-core is optional
        const puppeteer = await import('puppeteer-core');
        const browser = await puppeteer.default.launch({
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
          executablePath: chromePath,
          headless: true,
        });
        try {
          const page = await browser.newPage();
          await page.setContent(html, { waitUntil: 'load' });
          const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
          });

          const domain = new URL(scan.url.startsWith('http') ? scan.url : `https://${scan.url}`).hostname;
          return reply
            .header('Content-Type', 'application/pdf')
            .header('Content-Disposition', `attachment; filename="${domain}-report-${id.slice(0, 8)}.pdf"`)
            .send(Buffer.from(pdfBuffer));
        } finally {
          await browser.close();
        }
      } catch (err) {
        request.log.warn(`PDF generation failed, falling back to HTML: ${String(err)}`);
        return reply.header('Content-Type', 'text/html; charset=utf-8').send(html);
      }
    }

    return reply.header('Content-Type', 'text/html; charset=utf-8').send(html);
  });

  // ── Per-handler routes ──────────────────────────────────────────
  for (const name of getHandlerNames()) {
    const entry = registry[name];

    app.get(`/api/${name}`, {
      schema: {
        description: entry.metadata.description,
        tags: [entry.metadata.category],
        querystring: urlQuerySchema,
      },
      preHandler: validateUrlHook,
    }, async (request) => {
      const { url } = request.query as { url: string };
      const apiKeys = getPopulatedApiKeys();

      const result = await entry.handler(url, {
        timeout: config.timeoutLimit,
        apiKeys,
        chromePath: config.chromePath,
      });

      return result;
    });
  }
}
