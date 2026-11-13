import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import config from './config/index.js';
import apiRoutes from './routes/index.js';
import requestContext from './middleware/requestContext.js';
import requestLogger from './middleware/requestLogger.js';
import errorHandler, { notFoundHandler } from './middleware/errorHandler.js';
import { apiLimiter } from './middleware/rateLimiters.js';
import { sendSuccess } from './utils/apiResponse.js';

/**
 * Is this Origin allowed to read responses?
 *
 * Exact match against the configured allowlist, plus — in development only —
 * the loopback aliases of an allowed host. A browser treats localhost and
 * 127.0.0.1 as distinct origins, and Vite serves on both, so allowing just one
 * spelling produces intermittent CORS failures that look like an API outage.
 *
 * The alias rule is deliberately narrow: same protocol, same port, and the host
 * must be a loopback name we swapped. It cannot accidentally match a real
 * domain, and production never enables it.
 */
const LOOPBACK_ALIASES = new Map([
  ['localhost', '127.0.0.1'],
  ['127.0.0.1', 'localhost'],
]);

function isAllowedOrigin(origin) {
  if (config.cors.origins.includes(origin)) return true;
  if (!config.cors.allowLoopbackAliases) return false;

  let parsed;
  try {
    parsed = new URL(origin);
  } catch {
    return false;
  }

  const alias = LOOPBACK_ALIASES.get(parsed.hostname);
  if (!alias) return false;

  // Only compare against origins we already trust; the alias just re-spells
  // the host, it does not widen the allowlist.
  const aliased = `${parsed.protocol}//${alias}${parsed.port ? `:${parsed.port}` : ''}`;
  return config.cors.origins.includes(aliased);
}

/**
 * Express application factory.
 *
 * Exported separately from server.js so tests can mount the app without opening
 * a port or connecting to a database. Nothing here connects to MongoDB — that
 * is server.js's job — which keeps the HTTP layer testable in isolation.
 */
export function createApp() {
  const app = express();

  // Behind a proxy (nginx, Render, Railway) trust the forwarding headers so
  // rate limiting and req.ip see the real client, not the proxy.
  if (config.rateLimit.trustProxy) {
    app.set('trust proxy', 1);
  }

  app.disable('x-powered-by');

  // ------------------------------------------------------------------ security
  app.use(
    helmet({
      // This is a JSON API, not a document host. CSP defaults are relaxed only
      // where the API itself needs them, and CORP is left open so the future
      // API-served assets can be consumed by the frontend origin.
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      referrerPolicy: { policy: 'no-referrer' },
    }),
  );

  // ---------------------------------------------------------------------- cors
  app.use(
    cors({
      origin(origin, callback) {
        // Same-origin, curl and server-to-server requests have no Origin header.
        if (!origin) return callback(null, true);

        if (isAllowedOrigin(origin)) return callback(null, true);

        // Reject without throwing: CORS failures should not 500 the request.
        // A browser then reports the blocked request clearly, instead of the
        // request dying with a 500 and looking like a server bug.
        return callback(null, false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
      exposedHeaders: ['X-Request-Id', 'RateLimit', 'RateLimit-Policy', 'Retry-After'],
      maxAge: 86_400,
    }),
  );

  // ------------------------------------------------------------------- parsing
  // 1mb is enough for JSON payloads; PDFs are uploaded separately in Phase 3
  // (multipart to object storage) and must never arrive as base64 JSON.
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // ------------------------------------------------------------------- logging
  app.use(requestContext);
  app.use(requestLogger({ level: config.logging.level }));

  // ------------------------------------------------------------------ routing
  // Root: tiny discovery document so a fresh deployment is self-explanatory.
  app.get('/', (req, res) =>
    sendSuccess(res, {
      service: 'SmartPrint API',
      status: 'running',
      health: '/api/health',
      version: '1.0.0',
    }),
  );

  // Global rate limiter, applied before the API router so every /api request
  // passes through it. Health probes are exempted: an uptime check must never
  // be throttled into reporting the service as down.
  app.use('/api', (req, res, next) => {
    if (req.path === '/health' || req.path.startsWith('/health/')) return next();
    return apiLimiter(req, res, next);
  });

  app.use('/api', apiRoutes);

  // ----------------------------------------------------------------------- 404
  app.use(notFoundHandler);

  // ------------------------------------------------------------- error handler
  app.use(errorHandler);

  return app;
}

// Convenience default: a ready-to-use instance.
// Tests that need isolation should call createApp() instead.
const app = createApp();

export default app;
