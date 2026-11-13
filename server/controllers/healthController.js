import asyncHandler from '../utils/asyncHandler.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { getHealthReport } from '../services/healthService.js';
import config from '../config/index.js';

/**
 * GET /api/health
 *
 * Liveness + a snapshot of dependency status. Always 200 while the process is
 * alive, so it is safe to use as a liveness/uptime probe even before MongoDB is
 * connected. The `database.connected` flag tells the caller what is usable.
 */
export const getHealth = asyncHandler(async (req, res) => {
  const report = await getHealthReport({ deep: true });

  return sendSuccess(res, {
    status: report.status, // 'ok'
    timestamp: report.timestamp,
    uptimeSeconds: report.uptimeSeconds,
    environment: report.environment,
    database: report.database,
  });
});

/**
 * GET /api/health/ready
 *
 * Readiness probe: 503 until the database actually answers.
 */
export const getReadiness = asyncHandler(async (req, res) => {
  const report = await getHealthReport({ deep: true });

  if (!report.ready) {
    return sendError(res, {
      status: 503,
      code: 'NOT_READY',
      message: report.database.configured
        ? 'Database is not reachable'
        : 'Database is not configured',
      requestId: req.id,
    });
  }

  return sendSuccess(res, {
    status: 'ready',
    timestamp: report.timestamp,
    uptimeSeconds: report.uptimeSeconds,
    database: report.database,
  });
});

/**
 * GET /api/health/details
 *
 * Fuller operator view: memory, pid, node version, environment. Disabled in
 * production unless the caller is authenticated as an admin (Phase 3), so it
 * exposes 404 to anonymous callers there instead of leaking internals.
 */
export const getHealthDetails = asyncHandler(async (req, res) => {
  if (config.isProduction) {
    return sendError(res, {
      status: 404,
      code: 'NOT_FOUND',
      message: 'Not found',
      requestId: req.id,
    });
  }

  const report = await getHealthReport({ deep: true });
  return sendSuccess(res, report);
});
