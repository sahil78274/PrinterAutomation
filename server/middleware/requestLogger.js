import logger from '../utils/logger.js';
import { requestDurationMs } from './requestContext.js';

const LEVEL_FOR_STATUS = (status) => {
  if (status >= 500) return 'error';
  if (status >= 400) return 'warn';
  return 'info';
};

/**
 * Dependency-free request logger.
 *
 * Skips health checks in production so uptime probes don't flood the log.
 */
export default function requestLogger({ level = 'dev', skipHealthChecks = true } = {}) {
  return function logRequest(req, res, next) {
    if (level === 'off') return next();

    const isHealth = req.path === '/api/health';
    if (skipHealthChecks && isHealth && process.env.NODE_ENV === 'production') return next();

    // Log once the response is finished, so status and duration are accurate.
    res.on('finish', () => {
      const duration = requestDurationMs(req);
      const status = res.statusCode;
      const method = req.method;
      const url = req.originalUrl;
      const message = `${method} ${url} ${status} · ${duration}ms`;

      const meta = { requestId: req.id, ip: req.ip };
      const logLevel = LEVEL_FOR_STATUS(status);
      logger[logLevel](message, meta);
    });

    next();
  };
}
