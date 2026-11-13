import { getConnectionState, pingDatabase } from '../config/database.js';
import { isDatabaseConfigured } from '../config/index.js';

/**
 * Health reporting.
 *
 * Two distinct questions, deliberately answered separately:
 *
 *  - LIVENESS  ("is the process up?") — always 200 if this code runs at all.
 *  - READINESS ("can it serve traffic?") — 200 only when MongoDB answers a ping.
 *
 * Conflating the two is a classic operational trap: an uptime probe that fails
 * because a dependency is down would restart a perfectly healthy process.
 *
 * `GET /api/health` returns liveness by default (200) with the database status
 * in the body, so it works before any database exists.
 * `GET /api/health/ready` returns 503 when the database is unreachable.
 */

const startedAt = Date.now();

export function getUptimeSeconds() {
  return Math.floor((Date.now() - startedAt) / 1000);
}

export function getProcessMetrics() {
  const memory = process.memoryUsage();
  return {
    uptimeSeconds: getUptimeSeconds(),
    nodeVersion: process.version,
    pid: process.pid,
    memory: {
      rssMb: Math.round((memory.rss / 1024 / 1024) * 10) / 10,
      heapUsedMb: Math.round((memory.heapUsed / 1024 / 1024) * 10) / 10,
    },
  };
}

/**
 * Build the health payload.
 * @param {{ deep?: boolean }} options deep=true runs an actual ping
 */
export async function getHealthReport({ deep = false } = {}) {
  const configured = isDatabaseConfigured();
  const connection = getConnectionState();

  let database = {
    configured,
    status: configured ? connection.state : 'not_configured',
    connected: connection.isConnected,
    name: connection.name,
    latencyMs: null,
    error: null,
  };

  if (configured && deep) {
    const ping = await pingDatabase();
    database = {
      ...database,
      connected: ping.ok,
      status: ping.ok ? 'connected' : 'unreachable',
      latencyMs: ping.latencyMs,
      error: ping.error,
    };
  }

  const ready = database.connected;

  return {
    // The three fields the brief asks for, plus context for operators.
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptimeSeconds: getUptimeSeconds(),
    environment: process.env.NODE_ENV || 'development',
    database,
    process: getProcessMetrics(),
    ready,
  };
}

export default { getHealthReport, getProcessMetrics, getUptimeSeconds };
