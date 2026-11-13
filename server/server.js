import http from 'node:http';
import { createApp } from './app.js';
import config, { validateConfig } from './config/index.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import logger from './utils/logger.js';

/**
 * Process entry point: configuration validation → database → HTTP listener →
 * signal handling.
 *
 * Startup policy: the HTTP server binds even when MongoDB is unreachable. That
 * is deliberate — /api/health must be able to report *why* the service is
 * degraded, which is impossible if the process refuses to start. Database-backed
 * routes fail with a 503 via the requireDatabase guard instead.
 */

let server = null;
let shuttingDown = false;

async function startDatabase() {
  if (!config.mongo.uri) {
    logger.warn('MONGODB_URI not set — starting without a database (health checks only)');
    return;
  }

  try {
    const state = await connectDatabase(logger);
    logger.info(`Database ready · "${state.name}" on ${state.host}`);
  } catch (error) {
    // Non-fatal by design: keep serving /api/health so the failure is observable.
    logger.error(`Initial MongoDB connection failed: ${error.message}`);
    logger.warn('Continuing without a database. Database-backed routes will return 503.');
  }
}

export async function startServer() {
  try {
    const warnings = validateConfig({ requireMongo: false });
    warnings.forEach((warning) => logger.warn(warning));
  } catch (error) {
    logger.error(error.message);
    process.exit(1);
  }

  await startDatabase();

  const app = createApp();
  server = http.createServer(app);

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(config.server.port, config.server.host, () => {
      server.off('error', reject);
      resolve();
    });
  });

  logger.info(
    `SmartPrint API listening on http://${config.server.host}:${config.server.port} · ${config.env}`,
  );
  logger.info(`CORS allowed origins: ${config.cors.origins.join(', ')}`);

  return server;
}

/**
 * Graceful shutdown: stop accepting connections, let in-flight requests finish,
 * then close the database. A hard timeout guarantees the process still exits if
 * a client keeps a socket open, so orchestrators are not left waiting.
 */
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.info(`${signal} received — shutting down gracefully`);

  const forceExit = setTimeout(() => {
    logger.error(`Shutdown exceeded ${config.server.shutdownTimeoutMs}ms — forcing exit`);
    process.exit(1);
  }, config.server.shutdownTimeoutMs);
  forceExit.unref();

  try {
    if (server) {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
      logger.info('HTTP server closed');
    }

    await disconnectDatabase();
    logger.info('Database connection closed');

    clearTimeout(forceExit);
    logger.info('Shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error(`Error during shutdown: ${error.message}`);
    clearTimeout(forceExit);
    process.exit(1);
  }
}

// Only wire up signals when run directly, so importing this module in tests has
// no side effects.
const isDirectRun = process.argv[1] && process.argv[1].endsWith('server.js');

if (isDirectRun) {
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGHUP', () => shutdown('SIGHUP'));

  process.on('unhandledRejection', (reason) => {
    logger.error(`Unhandled promise rejection: ${reason?.message ?? reason}`, {
      stack: reason?.stack,
    });
  });

  process.on('uncaughtException', (error) => {
    // An uncaught exception leaves the process in an unknown state: log, then
    // shut down rather than limping along.
    logger.error(`Uncaught exception: ${error.message}`, { stack: error.stack });
    shutdown('uncaughtException');
  });

  startServer().catch((error) => {
    logger.error(`Failed to start server: ${error.message}`, { stack: error.stack });
    process.exit(1);
  });
}

export { shutdown };
