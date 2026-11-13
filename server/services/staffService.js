import ApiError from '../utils/ApiError.js';
import { getRepository } from '../repositories/active.js';
import { hashPassword } from './passwordService.js';

/**
 * Staff management.
 *
 * A shop owner can invite staff into their own shop and nothing else. Two hard
 * rules:
 *
 *  1. An owner can never create an `admin` or another `owner` — escalation is
 *     refused here, not merely hidden in the UI.
 *  2. Every write is filtered by the caller's shopId, so a guessed user id from
 *     another tenant resolves to a 404.
 */

export const STAFF_ROLES = ['staff'];

/**
 * Permissions a staff member may hold.
 *
 * These strings are the same ones `middleware/auth.js` checks via
 * `STAFF_PERMISSIONS` — one vocabulary, so a permission granted here is the
 * exact permission the route guard looks for. Storing a different spelling
 * would grant nothing while looking correct in the UI.
 */
export const PERMISSIONS = Object.freeze({
  MANAGE_MACHINES: 'manageMachines',
  MANAGE_ORDERS: 'manageOrders',
  VIEW_REPORTS: 'viewReports',
  MANAGE_PRICING: 'managePricing',
});

export const ALL_PERMISSIONS = Object.values(PERMISSIONS);

/** Sensible defaults for a counter assistant. */
export const DEFAULT_STAFF_PERMISSIONS = Object.freeze([
  PERMISSIONS.MANAGE_ORDERS,
  PERMISSIONS.VIEW_REPORTS,
]);

export function publicUser(user) {
  if (!user) return null;
  // An explicit allowlist: a new sensitive column must never leak by default.
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    shopId: user.shopId ?? null,
    status: user.status,
    permissions: user.permissions ?? [],
    lastLoginAt: user.lastLoginAt ?? null,
    createdAt: user.createdAt,
  };
}

/** POST /api/staff — create a staff account inside the caller's shop. */
export async function createStaff(
  { shopId, name, email, password, permissions },
  { actorId = null } = {},
) {
  if (!shopId) throw ApiError.badRequest('A shop is required', { code: 'SHOP_REQUIRED' });

  const repo = getRepository();
  const normalisedEmail = String(email ?? '')
    .trim()
    .toLowerCase();

  const existing = await repo.findOne('users', { email: normalisedEmail });
  if (existing) {
    throw ApiError.conflict('An account with this email already exists', {
      code: 'EMAIL_TAKEN',
    });
  }

  const shop = await repo.findById('shops', shopId);
  if (!shop) throw ApiError.notFound('Shop not found', { code: 'SHOP_NOT_FOUND' });

  const requested = Array.isArray(permissions) ? permissions : DEFAULT_STAFF_PERMISSIONS;
  const invalid = requested.filter((permission) => !ALL_PERMISSIONS.includes(permission));
  if (invalid.length) {
    throw ApiError.unprocessable('Unknown permission requested', {
      code: 'VALIDATION_ERROR',
      details: { permissions: `Unknown: ${invalid.join(', ')}` },
    });
  }

  const passwordHash = await hashPassword(password);

  const user = await repo.insert('users', {
    name: String(name).trim(),
    email: normalisedEmail,
    passwordHash,
    // Force-assigned, never taken from the request.
    role: 'staff',
    shopId,
    status: 'active',
    permissions: requested,
    createdBy: actorId,
    mustChangePassword: true,
    lastLoginAt: null,
  });

  return user;
}

/** GET /api/staff — the caller's shop only. */
export async function listStaff(shopId) {
  if (!shopId) throw ApiError.badRequest('A shop is required', { code: 'SHOP_REQUIRED' });
  const repo = getRepository();
  const users = await repo.findAll('users', { shopId }, { sort: { createdAt: 1 } });
  return users.map(publicUser);
}

/** PATCH /api/staff/:userId — permissions and status, within the caller's shop. */
export async function updateStaff(shopId, userId, patch, { actorId = null } = {}) {
  const repo = getRepository();

  // The shopId is part of the query, not a post-hoc check: a staff id belonging
  // to another shop simply does not resolve.
  const user = await repo.findOne('users', { id: userId, shopId });
  if (!user) throw ApiError.notFound('Staff member not found', { code: 'USER_NOT_FOUND' });

  if (user.role !== 'staff') {
    throw ApiError.forbidden('Only staff accounts can be changed here', {
      code: 'ROLE_IMMUTABLE',
      details: { role: user.role },
    });
  }

  const updates = {};

  if (patch.permissions !== undefined) {
    const requested = Array.isArray(patch.permissions) ? patch.permissions : [];
    const invalid = requested.filter((permission) => !ALL_PERMISSIONS.includes(permission));
    if (invalid.length) {
      throw ApiError.unprocessable('Unknown permission requested', {
        code: 'VALIDATION_ERROR',
        details: { permissions: `Unknown: ${invalid.join(', ')}` },
      });
    }
    updates.permissions = requested;
  }

  if (patch.status !== undefined) {
    if (!['active', 'suspended'].includes(patch.status)) {
      throw ApiError.unprocessable('Invalid account status', {
        code: 'VALIDATION_ERROR',
        details: { status: "Must be 'active' or 'suspended'" },
      });
    }
    updates.status = patch.status;
  }

  if (patch.name !== undefined) {
    const name = String(patch.name).trim();
    if (name.length < 2) {
      throw ApiError.unprocessable('Name is too short', {
        code: 'VALIDATION_ERROR',
        details: { name: 'At least 2 characters' },
      });
    }
    updates.name = name;
  }

  if (!Object.keys(updates).length) {
    throw ApiError.badRequest('Nothing to update', { code: 'NO_CHANGES' });
  }

  updates.updatedBy = actorId;
  const updated = await repo.updateById('users', user.id, updates);
  return updated;
}

/**
 * Deactivate a staff account.
 *
 * Never a hard delete: the audit trail and historical orders must stay
 * attributable to a real account.
 */
export async function deactivateStaff(shopId, userId, { actorId = null } = {}) {
  const repo = getRepository();
  const user = await repo.findOne('users', { id: userId, shopId });
  if (!user) throw ApiError.notFound('Staff member not found', { code: 'USER_NOT_FOUND' });

  if (user.role !== 'staff') {
    throw ApiError.forbidden('Only staff accounts can be deactivated here', {
      code: 'ROLE_IMMUTABLE',
    });
  }

  // Their refresh tokens are revoked so an active session cannot outlive the
  // deactivation.
  const tokens = await repo.findAll('refreshTokens', { userId: user.id, revokedAt: null });
  await Promise.all(
    tokens.map((token) =>
      repo.updateById('refreshTokens', token.id, {
        revokedAt: new Date().toISOString(),
        revokedReason: 'account_deactivated',
      }),
    ),
  );

  return repo.updateById('users', user.id, {
    status: 'suspended',
    deactivatedAt: new Date().toISOString(),
    deactivatedBy: actorId,
  });
}

export default {
  ALL_PERMISSIONS,
  DEFAULT_STAFF_PERMISSIONS,
  PERMISSIONS,
  createStaff,
  deactivateStaff,
  listStaff,
  publicUser,
  updateStaff,
};
