import { app } from './app.js';
import { env } from './config/env.js';
import { pool } from './database/pool.js';

const server = app.listen(env.PORT, '0.0.0.0', () => {
  console.log(`Mctaba API listening on port ${env.PORT} (${env.NODE_ENV}).`);
});

let isShuttingDown = false;

async function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`${signal} received; shutting down Mctaba API.`);

  server.close(async (error) => {
    try {
      await pool.end();
      process.exit(error ? 1 : 0);
    } catch (shutdownError) {
      console.error('Error while closing PostgreSQL pool:', shutdownError.message);
      process.exit(1);
    }
  });

  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
