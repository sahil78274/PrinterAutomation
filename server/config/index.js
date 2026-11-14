import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load server/.env (never committed). Falls back to real environment variables,
// which is how production deployments should inject configuration.
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const toInt = (value, fallback) => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toBool = (value, fallback = false) => {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
};

const NODE_ENV = process.env.NODE_ENV || 'development';
const isProduction = NODE_ENV === 'production';
const isTest = NODE_ENV === 'test';

const config = {
  env: NODE_ENV,
  isProduction,
  isTest,

  server: {
    port: toInt(process.env.PORT, 5000),
    // Bind address. 0.0.0.0 keeps the API reachable from the Vite dev server
    // and from containerised previews.
    host: process.env.HOST || '0.0.0.0',
    // Graceful shutdown budget for in-flight requests.
    shutdownTimeoutMs: toInt(process.env.SHUTDOWN_TIMEOUT_MS, 10_000),
  },

  cors: {
    // Comma-separated list, e.g. "http://localhost:5173,https://smartprint.in".
    // The localhost default exists for local development only; validateConfig
    // refuses to start a production process that relies on it.
    origins: (process.env.CLIENT_URL || 'http://localhost:5173')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    // True when the allowlist came from the dev fallback rather than config.
    isDefault: !process.env.CLIENT_URL,
    /**
     * Allow the loopback aliases in development.
     *
     * A browser treats http://localhost:5173 and http://127.0.0.1:5173 as two
     * different origins, and Vite binds 0.0.0.0 so either can be used to open
     * the app. Listing only "localhost" means half the normal dev URLs fail
     * with a CORS error that looks like a backend outage.
     *
     * Development only, and only for loopback: production must name its
     * origins explicitly.
     */
    allowLoopbackAliases: !isProduction,
  },

  mongo: {
    uri: process.env.MONGODB_URI || '',
    // Fail fast instead of buffering commands for 10s when Mongo is unreachable.
    serverSelectionTimeoutMS: toInt(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS, 8_000),
    connectTimeoutMS: toInt(process.env.MONGO_CONNECT_TIMEOUT_MS, 8_000),
    socketTimeoutMS: toInt(process.env.MONGO_SOCKET_TIMEOUT_MS, 45_000),
    maxPoolSize: toInt(process.env.MONGO_MAX_POOL_SIZE, 10),
    minPoolSize: toInt(process.env.MONGO_MIN_POOL_SIZE, 0),
    autoIndex: !isProduction,
    dbName: process.env.MONGO_DB_NAME || undefined,
  },

  rateLimit: {
    // Global API limiter.
    windowMs: toInt(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
    max: toInt(process.env.RATE_LIMIT_MAX, 300),
    // Tighter limiter for the public QR portal (order creation, uploads later).
    publicWindowMs: toInt(process.env.PUBLIC_RATE_LIMIT_WINDOW_MS, 60 * 1000),
    publicMax: toInt(process.env.PUBLIC_RATE_LIMIT_MAX, 60),
    // Behind a proxy/load balancer (Render, Railway, nginx) this must be true,
    // otherwise every client shares one bucket.
    trustProxy: toBool(process.env.TRUST_PROXY, false),
  },

  logging: {
    // 'dev' | 'combined' | 'common' | 'short' | 'tiny' | 'off'
    // Kept dependency-free: a tiny request logger lives in middleware/requestLogger.js
    level: process.env.LOG_LEVEL || (isTest ? 'off' : 'dev'),
  },

  security: {
    // Cross-site request forgery protection arrives with cookie auth.
    // Placeholder so the CORS/helmet policy can be tightened per environment.
    exposeStackTraces: !isProduction,
  },

  auth: {
    /**
     * Signing secret for access tokens.
     *
     * In production this MUST come from the environment — validateConfig
     * refuses to boot otherwise. In development a per-process random secret is
     * generated so tokens are never signed with a value that leaked into a
     * repository. The consequence is honest: restarting the dev server
     * invalidates every session.
     */
    jwtSecret: process.env.JWT_SECRET || null,
    jwtSecretIsEphemeral: !process.env.JWT_SECRET,
    issuer: 'smartprint',
    audience: 'smartprint-api',
    accessTokenTtl: process.env.ACCESS_TOKEN_TTL || '15m',
    refreshTokenTtlDays: toInt(process.env.REFRESH_TOKEN_TTL_DAYS, 30),
    bcryptRounds: toInt(process.env.BCRYPT_ROUNDS, isTest ? 4 : 12),

    /**
     * Key required to create the *first* platform administrator.
     *
     * Bootstrapping an admin is a chicken-and-egg problem: there is nobody to
     * grant the role. Rather than leaving an open "create admin" endpoint or
     * shipping a default password in git, the endpoint demands a key that the
     * operator sets in the environment. When it is unset the route is closed.
     */
    adminSetupKey: process.env.ADMIN_SETUP_KEY || null,
    // Refresh tokens are stored hashed; this pepper is part of that hash.
    refreshTokenPepper: process.env.REFRESH_TOKEN_PEPPER || '',
    passwordResetTtlMinutes: toInt(process.env.PASSWORD_RESET_TTL_MINUTES, 30),
  },

  uploads: {
    // PDFs only, and small enough that a base64 body can never be the path.
    maxBytes: toInt(process.env.UPLOAD_MAX_BYTES, 25 * 1024 * 1024),
    // Temporary store. Documents are deleted after the retention window.
    dir: process.env.UPLOAD_DIR || path.resolve(__dirname, '..', 'storage', 'documents'),
    retentionHours: toInt(process.env.DOCUMENT_RETENTION_HOURS, 24),
  },

  payments: {
    /**
     * The only provider implemented is the development simulator.
     * validateConfig refuses to start production with it enabled.
     */
    provider: process.env.PAYMENT_PROVIDER || 'development',
    platformFeeBps: toInt(process.env.PLATFORM_FEE_BPS, 600),
  },

  realtime: {
    enabled: toBool(process.env.REALTIME_ENABLED, true),
  },

  email: {
    /**
     * SMTP configuration for sending emails (password resets, welcome emails, etc.)
     *
     * When not configured:
     * - Password reset tokens are logged to console in development
     * - The frontend shows a clear message that email delivery is disabled
     * - No emails are sent
     *
     * For production, all five SMTP_* variables must be set.
     */
    smtp: {
      host: process.env.SMTP_HOST || null,
      port: toInt(process.env.SMTP_PORT, 587),
      user: process.env.SMTP_USER || null,
      pass: process.env.SMTP_PASS || null,
      from: process.env.SMTP_FROM || null, // e.g. "SmartPrint <noreply@smartprint.in>"
    },
    /**
     * Base URL used for building password reset links.
     * Falls back to CLIENT_URL or localhost.
     */
    appUrl: process.env.APP_URL || process.env.CLIENT_URL || 'http://localhost:5173',
  },
};

/**
 * Validate configuration once at boot so failures are loud and immediate
 * rather than surfacing as a confusing runtime error later.
 *
 * Returns an array of warnings (non-fatal) and throws on fatal problems.
 */
export function validateConfig({ requireMongo = true } = {}) {
  const warnings = [];
  const errors = [];

  if (!config.mongo.uri) {
    if (requireMongo) {
      errors.push(
        'MONGODB_URI is not set. Copy server/.env.example to server/.env and set MONGODB_URI.',
      );
    } else {
      warnings.push('MONGODB_URI is not set — database features are disabled.');
    }
  } else if (!/^mongodb(\+srv)?:\/\//.test(config.mongo.uri)) {
    errors.push('MONGODB_URI must start with mongodb:// or mongodb+srv://.');
  }

  if (!config.cors.origins.length) {
    errors.push('CLIENT_URL must list at least one allowed origin.');
  }

  if (config.isProduction && config.cors.origins.includes('*')) {
    errors.push('Wildcard CORS origin is not allowed in production.');
  }

  if (config.isProduction && config.cors.isDefault) {
    // Silently allowing only localhost in production looks fine in tests and
    // breaks every real browser, so it must stop the process at boot.
    errors.push('CLIENT_URL is not set. Production must list at least one real origin.');
  }

  // Production must not run on an ephemeral signing secret, or every deploy
  // silently logs all users out and tokens cannot be verified across instances.
  if (isProduction && !config.auth.jwtSecret) {
    errors.push('JWT_SECRET must be set in production.');
  }
  if (config.auth.jwtSecret && String(config.auth.jwtSecret).length < 32 && isProduction) {
    errors.push('JWT_SECRET must be at least 32 characters in production.');
  }

  // The development payment provider simulates success. Shipping it to
  // production would mean printing for free.
  if (isProduction && config.payments.provider === 'development') {
    errors.push('PAYMENT_PROVIDER=development is not allowed in production.');
  }

  if (errors.length) {
    const error = new Error(`Invalid configuration:\n  - ${errors.join('\n  - ')}`);
    error.name = 'ConfigError';
    throw error;
  }

  return warnings;
}

export function isDatabaseConfigured() {
  return Boolean(config.mongo.uri);
}

export default config;
