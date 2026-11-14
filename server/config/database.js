import mongoose from 'mongoose';
import config from './index.js';

/**
 * MongoDB connection management.
 *
 * Design notes
 * - One Mongoose connection per process, reused across requests.
 * - `serverSelectionTimeoutMS` is short so a wrong URI fails fast instead of
 *   hanging the request that triggered the first query.
 * - Connection events are wired to the shared logger so an outage is visible
 *   in server logs rather than silently breaking endpoints.
 */

const READY_STATES = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
  99: 'uninitialized',
};

let listenersAttached = false;

function attachConnectionListeners(logger) {
  if (listenersAttached) return;
  listenersAttached = true;

  const { connection } = mongoose;

  connection.on('connected', () => {
    logger.info(`MongoDB connected · database "${connection.name}"`);
  });

  connection.on('error', (error) => {
    logger.error(`MongoDB error: ${error.message}`);
  });

  connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
  });

  connection.on('reconnected', () => {
    logger.info('MongoDB reconnected');
  });
}

export function getConnectionState() {
  const state = READY_STATES[mongoose.connection.readyState] ?? 'unknown';
  return {
    state,
    isConnected: mongoose.connection.readyState === 1,
    name: mongoose.connection.name ?? null,
    host: mongoose.connection.host ?? null,
  };
}

/**
 * Ping the server. Unlike `readyState`, this proves the socket actually works.
 * Returns { ok, latencyMs, error } — never throws.
 *
 * `timeoutMs` bounds the probe for callers that must not block for long
 * (startup checks, health endpoints). Never throws, so a timeout is just an
 * unsuccessful result.
 */
export async function pingDatabase({ timeoutMs } = {}) {
  const started = Date.now();

  const probe = async () => {
    if (!mongoose.connection.db) {
      return { ok: false, latencyMs: null, error: 'No database handle available' };
    }
    await mongoose.connection.db.admin().ping();
    return { ok: true, latencyMs: Date.now() - started, error: null };
  };

  if (!timeoutMs) {
    try {
      return await probe();
    } catch (error) {
      return { ok: false, latencyMs: null, error: error.message };
    }
  }

  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(
      () => resolve({ ok: false, latencyMs: null, error: `Ping timed out after ${timeoutMs}ms` }),
      timeoutMs,
    );
    timer.unref?.();
  });

  try {
    return await Promise.race([probe(), timeout]);
  } catch (error) {
    return { ok: false, latencyMs: null, error: error.message };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Connect to MongoDB.
 *
 * `overrides` exists for callers that need a different failure budget than the
 * process default — notably tests probing an unknown host, which must give up
 * in seconds rather than the production 8s.
 */
export async function connectDatabase(logger, overrides = {}) {
  if (!config.mongo.uri) {
    throw new Error('MONGODB_URI is not configured');
  }

  attachConnectionListeners(logger);

  mongoose.set('strictQuery', true);

  await mongoose.connect(config.mongo.uri, {
    serverSelectionTimeoutMS: config.mongo.serverSelectionTimeoutMS,
    connectTimeoutMS: config.mongo.connectTimeoutMS,
    socketTimeoutMS: config.mongo.socketTimeoutMS,
    maxPoolSize: config.mongo.maxPoolSize,
    minPoolSize: config.mongo.minPoolSize,
    autoIndex: config.mongo.autoIndex,
    ...(config.mongo.dbName ? { dbName: config.mongo.dbName } : {}),
    ...overrides,
  });

  return getConnectionState();
}

export async function disconnectDatabase() {
  if (mongoose.connection.readyState === 0) return;
  await mongoose.connection.close(false);
}

/**
 * Connect to MongoDB with a default console logger.
 * Used by CLI scripts and other non-server entry points.
 */
export async function connectToDatabase() {
  const consoleLogger = {
    info: (msg) => console.log(`[DB] ${msg}`),
    warn: (msg) => console.warn(`[DB] ${msg}`),
    error: (msg) => console.error(`[DB] ${msg}`),
    debug: () => {},
  };
  return connectDatabase(consoleLogger);
}

/** Re-export for convenience so models import a single mongoose instance. */
export { mongoose };
