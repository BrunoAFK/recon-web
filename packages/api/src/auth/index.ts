import { timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';

/** Public routes that skip authentication. */
const PUBLIC_PATHS = new Set(['/health', '/api/handlers', '/docs']);

async function authPluginImpl(app: FastifyInstance): Promise<void> {
  const enabled = process.env.AUTH_ENABLED === 'true';
  const token = process.env.AUTH_TOKEN ?? '';

  if (!enabled) {
    if (process.env.NODE_ENV === 'production') {
      app.log.warn('Auth is DISABLED in production — API is publicly accessible. Set AUTH_ENABLED=true to secure it.');
    } else {
      app.log.info('Auth plugin loaded but AUTH_ENABLED is not true — skipping');
    }
    return;
  }

  if (!token) {
    app.log.warn('AUTH_ENABLED is true but AUTH_TOKEN is empty — all requests will be rejected');
  } else if (token.length < 32) {
    app.log.warn(`AUTH_TOKEN is only ${token.length} characters — use at least 32 characters for security`);
  }

  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    const path = request.url.split('?')[0];

    if (!path.startsWith('/api')) {
      return;
    }

    // Allow public endpoints through
    if (PUBLIC_PATHS.has(path)) {
      return;
    }

    const header = request.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'Missing or malformed Authorization header' });
    }

    const provided = header.slice(7);
    const a = Buffer.from(provided);
    const b = Buffer.from(token);
    const valid = a.length === b.length && timingSafeEqual(a, b);
    if (!valid) {
      return reply.code(401).send({ error: 'Invalid token' });
    }
  });
}

export const authPlugin = fp(authPluginImpl, {
  name: 'auth-plugin',
  fastify: '5.x',
});
