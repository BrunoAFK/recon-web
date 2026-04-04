import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import fastifyStatic from '@fastify/static';
import type BetterSqlite3 from 'better-sqlite3';
import { config } from './config.js';
import { registerRoutes } from './routes.js';
import { initDb } from './db/index.js';
import { authPlugin } from './auth/index.js';
import { schedulerPlugin } from './scheduler/index.js';

declare module 'fastify' {
  interface FastifyInstance {
    db: BetterSqlite3.Database;
  }
}

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function buildServer() {
  const app = Fastify({
    logger: true,
  });

  // ── Plugins ─────────────────────────────────────────────────────
  await app.register(cors, {
    origin: config.corsOrigin,
  });

  await app.register(rateLimit, {
    max: 100,
    timeWindow: '10 minutes',
  });

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'recon-web API',
        description: 'REST API for running web reconnaissance and analysis handlers against any URL.',
        version: '1.0.0',
      },
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
  });

  // ── Static files (serve built frontend if available) ────────────
  const staticDir = config.staticDir
    ? resolve(config.staticDir)
    : resolve(process.cwd(), 'packages', 'web', 'dist');

  if (existsSync(staticDir)) {
    await app.register(fastifyStatic, {
      root: staticDir,
      prefix: '/',
      wildcard: false,
      decorateReply: true,
    });
  }

  // ── Database ────────────────────────────────────────────────────
  const db = initDb(config.dbPath);
  app.decorate('db', db);
  app.addHook('onClose', () => db.close());

  // ── Auth ───────────────────────────────────────────────────────
  await app.register(authPlugin);

  // ── Routes ──────────────────────────────────────────────────────
  await registerRoutes(app);

  // ── Scheduler ─────────────────────────────────────────────────
  await app.register(schedulerPlugin);

  // ── SPA fallback ───────────────────────────────────────────────
  if (existsSync(staticDir)) {
    app.setNotFoundHandler((_req, reply) => {
      return reply.sendFile('index.html');
    });
  }

  return app;
}
