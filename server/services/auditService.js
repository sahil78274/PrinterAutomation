import { getRepository } from '../repositories/active.js';
import logger from '../utils/logger.js';

/**
 * Audit trail.
 *
 * Every state-changing action worth investigating later writes a row: who did
 * it, to what, from where, and when. Writes never throw — losing an audit row
 * must not roll back a legitimate business operation, but it is logged loudly
 * so the gap is visible rather than silent.
 *
 * Append-only by convention: there is no update or delete path.
 */

const REDACTED_KEYS = new Set([
  'password',
  'newPassword',
  'currentPassword',
  'passwordHash',
  'refreshToken',
  'token',
  'authorization',
]);

/** Recursively drop anything that looks like a credential. */
export function redact(value, depth = 0) {
  if (depth > 4 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => redact(item, depth + 1));

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      REDACTED_KEYS.has(key) ? '[redacted]' : redact(item, depth + 1),
    ]),
  );
}

/**
 * Record an audit entry.
 *
 * @param {object} req      Express request (for actor, ip, requestId)
 * @param {object} entry
 * @param {string} entry.action   e.g. 'order.created'
 * @param {string} [entry.entity]
 * @param {string} [entry.entityId]
 * @param {string} [entry.shopId]
 * @param {object} [entry.metadata]
 */
export async function audit(req, entry) {
  const record = {
    action: entry.action,
    entity: entry.entity ?? null,
    entityId: entry.entityId ?? null,
    shopId: entry.shopId ?? req?.auth?.shopId ?? null,
    actorId: entry.actorId ?? req?.auth?.userId ?? null,
    actorRole: req?.auth?.role ?? null,
    ip: req?.ip ?? null,
    requestId: req?.id ?? null,
    userAgent: req?.headers?.['user-agent'] ?? null,
    metadata: redact(entry.metadata ?? {}),
  };

  try {
    return await getRepository().insert('auditLogs', record);
  } catch (error) {
    logger.error(`Failed to write audit log for ${entry.action}: ${error.message}`);
    return null;
  }
}

/** Query the trail. Admin-only at the route layer. */
export async function listAuditLogs({ shopId, action, page, limit } = {}) {
  const repo = getRepository();
  const filter = {};
  if (shopId) filter.shopId = shopId;
  if (action) filter.action = action;

  const [entries, total] = await Promise.all([
    repo.find('auditLogs', filter, { page, limit, sort: { createdAt: -1 } }),
    repo.count('auditLogs', filter),
  ]);

  return { entries, total };
}
