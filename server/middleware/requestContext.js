import { randomUUID } from 'node:crypto';

/**
 * Attach a request id to every request so logs, error responses and future
 * audit records can be correlated.
 *
 * Accepts an inbound `X-Request-Id` (useful when a gateway already assigns one)
 * but validates it to avoid header injection into logs.
 */
export default function requestContext(req, res, next) {
  const inbound = req.get('x-request-id');
  const safeInbound = inbound && /^[A-Za-z0-9._-]{8,128}$/.test(inbound) ? inbound : null;

  req.id = safeInbound ?? randomUUID();
  req.startedAt = process.hrtime.bigint();

  res.setHeader('X-Request-Id', req.id);
  next();
}

export function requestDurationMs(req) {
  if (!req.startedAt) return null;
  const ns = process.hrtime.bigint() - req.startedAt;
  return Math.round(Number(ns) / 1e6);
}
