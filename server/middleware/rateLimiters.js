import rateLimit from 'express-rate-limit';
import config from '../config/index.js';
import { sendError } from '../utils/apiResponse.js';

/**
 * Rate limiters.
 *
 * - `apiLimiter`     generous global guard for the whole /api surface.
 * - `publicLimiter`  tighter bucket for the customer QR portal, which is the
 *                    only unauthenticated, write-capable surface (order
 *                    creation). Identified by IP plus, later, machine id.
 * - `authLimiter`    prepared for Phase 3 login/registration throttling.
 *
 * All limiters share one JSON error envelope so the client handles them like
 * any other API failure.
 */

const handler = (req, res) => {
  sendError(res, {
    status: 429,
    code: 'RATE_LIMITED',
    message: 'Too many requests. Please slow down and try again shortly.',
    requestId: req.id,
  });
};

const baseOptions = {
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler,
  // Skip throttling in the test suite so assertions are not order-dependent.
  skip: () => config.isTest,
};

export const apiLimiter = rateLimit({
  ...baseOptions,
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  keyGenerator: (req) => req.ip,
});

export const publicLimiter = rateLimit({
  ...baseOptions,
  windowMs: config.rateLimit.publicWindowMs,
  max: config.rateLimit.publicMax,
  keyGenerator: (req) => `${req.ip}:${req.params?.machineId ?? 'public'}`,
});

export const authLimiter = rateLimit({
  ...baseOptions,
  windowMs: 15 * 60 * 1000,
  max: 20,
  keyGenerator: (req) => req.ip,
  // A successful login should not count against the bucket.
  skipSuccessfulRequests: true,
});
