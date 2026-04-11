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
import type { FastifyInstance } from 'fastify';
import { config } from './config.js';
import { registerRoutes } from './routes.js';
import { initDb } from './db/index.js';
import { schedulerPlugin } from './scheduler/index.js';

declare module 'fastify' {
  interface FastifyInstance {
    db: BetterSqlite3.Database;
  }
}

export interface BuildServerOptions {
  /** Additional Fastify plugins to register before routes (e.g. auth) */
  plugins?: Array<(app: FastifyInstance) => Promise<void>>;
  /** Additional route registrations to run after core routes */
  routes?: Array<(app: FastifyInstance) => Promise<void>>;
  /** Override the static files directory */
  staticDir?: string;
}

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function buildServer(opts?: BuildServerOptions) {
  const app = Fastify({
    logger: true,
  });

  // ── Plugins ─────────────────────────────────────────────────────
  await app.register(cors, {
    origin: config.corsOrigin,
  });

  await app.register(rateLimit, {
    global: true,
    max: parseInt(process.env.RATE_LIMIT_MAX || '', 10) || 200,
    timeWindow: process.env.RATE_LIMIT_WINDOW || '1 minute',
    keyGenerator: (req) => req.ip,
    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
      'retry-after': true,
    },
  });

  if (process.env.SWAGGER_ENABLED === 'true') {
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
  }

  // ── Static files (serve built frontend if available) ────────────
  const staticDir = opts?.staticDir
    ? resolve(opts.staticDir)
    : config.staticDir
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
  const db = initDb(process.env.DB_PATH || config.dbPath);
  app.decorate('db', db);
  app.addHook('onClose', () => db.close());

  // ── External plugins (e.g. auth) ───────────────────────────────
  if (opts?.plugins) {
    for (const plugin of opts.plugins) {
      await plugin(app);
    }
  }

  // ── Routes ──────────────────────────────────────────────────────
  await registerRoutes(app);

  // ── External routes (e.g. auth routes, admin routes) ──────────
  if (opts?.routes) {
    for (const route of opts.routes) {
      await route(app);
    }
  }

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
