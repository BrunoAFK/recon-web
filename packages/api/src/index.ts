import 'dotenv/config';
import { config } from './config.js';
import { buildServer } from './server.js';

const start = async () => {
  const server = await buildServer();

  try {
    await server.listen({ port: config.port, host: config.host });

    for (const signal of ['SIGTERM', 'SIGINT'] as const) {
      process.on(signal, () => {
        server.log.info({ signal }, 'Received signal, shutting down...');
        server.close().then(() => process.exit(0));
      });
    }
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
