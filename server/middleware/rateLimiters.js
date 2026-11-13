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

/** Login: strict per-IP budget, keyed by email too so one attacker cannot lock
 * out every account from a shared IP, and one account cannot be brute-forced
 * from a botnet's worth of addresses in the same window. */
export const loginLimiter = rateLimit({
  ...baseOptions,
  windowMs: 15 * 60 * 1000,
  max: config.isTest ? 10_000 : 10,
  keyGenerator: (req) => `${req.ip}:${String(req.body?.email ?? '').toLowerCase()}`,
  // A successful login should not count against the bucket.
  skipSuccessfulRequests: true,
});

/** Registration: low ceiling, since one person needs one account. */
export const registerLimiter = rateLimit({
  ...baseOptions,
  windowMs: 60 * 60 * 1000,
  max: config.isTest ? 10_000 : 5,
  keyGenerator: (req) => req.ip,
});

/** Password reset: prevents using the endpoint to spam a mailbox. */
export const passwordResetLimiter = rateLimit({
  ...baseOptions,
  windowMs: 15 * 60 * 1000,
  max: config.isTest ? 10_000 : 5,
  keyGenerator: (req) => `${req.ip}:${String(req.body?.email ?? '').toLowerCase()}`,
});

/** Upload/order creation: the customer portal's write path. */
export const orderLimiter = rateLimit({
  ...baseOptions,
  windowMs: 10 * 60 * 1000,
  max: config.isTest ? 10_000 : 30,
  keyGenerator: (req) => req.ip,
});

/** Print agent polling: agents legitimately poll often, so the ceiling is high
 * but finite — an unauthenticated flood still gets cut off. */
export const agentLimiter = rateLimit({
  ...baseOptions,
  windowMs: 60 * 1000,
  max: config.isTest ? 100_000 : 600,
  keyGenerator: (req) => req.ip,
});

/** Kept for compatibility with the Phase 2 route table. */
export const authLimiter = loginLimiter;
