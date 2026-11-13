import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { verifyAccessToken } from '../services/tokenService.js';
import { getRepository } from '../repositories/active.js';

/**
 * Authentication and authorization.
 *
 * Rules this module enforces, in order:
 *   1. A request must carry a valid, unexpired access token.
 *   2. The user must still exist, be active, and not be soft-deleted.
 *   3. The token must not predate a `tokenVersion` bump (logout-everywhere,
 *      role change, password change).
 *   4. Role checks are exact and server-side. The frontend's route guards are
 *      UX only and are never the basis for an authorization decision.
 *   5. A shop-scoped user may only ever touch its own `shopId`. Admin-only
 *      routes are separate, and shop users cannot reach them at all.
 *
 * The user is re-read from storage on every authenticated request. That costs
 * one lookup and buys correctness: suspending an account takes effect
 * immediately rather than whenever the access token happens to expire.
 */

/** Roles, most privileged last. */
export const ROLES = Object.freeze({
  ADMIN: 'admin',
  OWNER: 'owner',
  STAFF: 'staff',
});

/**
 * Re-exported from the staff service so there is exactly one definition of the
 * vocabulary. A guard and a grant that spell a permission differently would fail
 * silently — the UI would show "granted", the route would say "forbidden".
 */
export const STAFF_PERMISSIONS = Object.freeze({
  /** Everything an owner can do to their own shop, minus destructive billing. */
  manageMachines: 'manageMachines',
  manageOrders: 'manageOrders',
  viewReports: 'viewReports',
  managePricing: 'managePricing',
});

// Guarded by a test: these must stay identical to staffService.PERMISSIONS.
export const ALL_STAFF_PERMISSIONS = Object.values(STAFF_PERMISSIONS);

function extractToken(req) {
  const header = req.headers.authorization ?? '';
  if (!header.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  return token || null;
}

/**
 * Populate `req.auth` with { userId, role, shopId, user }.
 * 401 when absent or invalid — never 403, so the client knows to re-auth.
 */
export const authenticate = asyncHandler(async (req, res, next) => {
  const token = extractToken(req);
  if (!token) {
    throw ApiError.unauthorized('Authentication required', { code: 'AUTH_REQUIRED' });
  }

  const payload = verifyAccessToken(token);

  const user = await getRepository().findById('users', payload.sub);
  if (!user) {
    throw ApiError.unauthorized('Account no longer exists', { code: 'ACCOUNT_NOT_FOUND' });
  }
  if (user.status !== 'active') {
    throw ApiError.forbidden('Account is not active', { code: 'ACCOUNT_INACTIVE' });
  }
  // A password change or forced logout bumps this, invalidating older tokens.
  if ((user.tokenVersion ?? 0) !== (payload.tokenVersion ?? 0)) {
    throw ApiError.unauthorized('Session is no longer valid. Please sign in again.', {
      code: 'TOKEN_STALE',
    });
  }

  req.auth = {
    userId: user.id,
    role: user.role,
    shopId: user.shopId ?? null,
    user,
  };
  next();
});

/**
 * Require one of the given roles.
 * Must run after `authenticate`.
 */
export function requireRole(...roles) {
  const allowed = roles.flat();
  return function roleGuard(req, res, next) {
    if (!req.auth) {
      return next(ApiError.unauthorized('Authentication required', { code: 'AUTH_REQUIRED' }));
    }
    if (!allowed.includes(req.auth.role)) {
      // 403 with a stable code, but no detail about what the role would allow.
      return next(
        ApiError.forbidden('You do not have permission to perform this action', {
          code: 'INSUFFICIENT_ROLE',
        }),
      );
    }
    return next();
  };
}

export const requireAdmin = requireRole(ROLES.ADMIN);
export const requireOwner = requireRole(ROLES.OWNER);
export const requireShopUser = requireRole(ROLES.OWNER, ROLES.STAFF);

/**
 * Resolve the shop a request applies to, and prove the caller may touch it.
 *
 * Source order: an explicit `:shopId` route param, then `req.body.shopId`, then
 * the caller's own shop. The important property is the last line: a shop user
 * whose `shopId` differs from the requested one is rejected, so a forged id in
 * a URL or body cannot cross tenants.
 *
 * Admins are allowed through, but they must *name* the shop — silently
 * defaulting an admin to some shop would be a data-leak footgun.
 */
export const resolveShopScope = asyncHandler(async (req, res, next) => {
  if (!req.auth) {
    throw ApiError.unauthorized('Authentication required', { code: 'AUTH_REQUIRED' });
  }

  const requested =
    req.params?.shopId ?? req.body?.shopId ?? req.query?.shopId ?? req.auth.shopId ?? null;

  if (!requested) {
    throw ApiError.badRequest('A shop must be specified', { code: 'SHOP_REQUIRED' });
  }

  if (req.auth.role === ROLES.ADMIN) {
    req.shopScope = { shopId: requested, isAdmin: true };
    return next();
  }

  if (String(requested) !== String(req.auth.shopId)) {
    // Deliberately a 403 rather than a 404: the resource may exist, but the
    // caller has no business knowing that.
    throw ApiError.forbidden('You do not have access to this shop', {
      code: 'CROSS_TENANT_DENIED',
    });
  }

  req.shopScope = { shopId: req.auth.shopId, isAdmin: false };
  next();
});

/**
 * Assert that a loaded resource belongs to the caller's shop.
 *
 * Call this after fetching by id. Fetching *by shopId* is preferable — it makes
 * the check structural — but some lookups (public QR resolution, agent
 * endpoints) arrive by another key and need an explicit assertion.
 */
export function assertShopAccess(req, resource, { notFound = true } = {}) {
  if (!resource) {
    throw ApiError.notFound('Resource not found', { code: 'NOT_FOUND' });
  }
  if (req.auth.role === ROLES.ADMIN) return resource;

  if (String(resource.shopId) !== String(req.auth.shopId)) {
    if (notFound) {
      // Same answer as a genuinely missing row: existence is itself private.
      throw ApiError.notFound('Resource not found', { code: 'NOT_FOUND' });
    }
    throw ApiError.forbidden('You do not have access to this resource', {
      code: 'CROSS_TENANT_DENIED',
    });
  }
  return resource;
}

/**
 * Staff permission gate.
 *
 * Owners implicitly hold every permission; staff hold only what is listed on
 * their account. Keeping this in one place means "who may reprice a printer"
 * has exactly one answer.
 */
export function requirePermission(permission) {
  return function permissionGuard(req, res, next) {
    if (!req.auth) {
      return next(ApiError.unauthorized('Authentication required', { code: 'AUTH_REQUIRED' }));
    }
    if (req.auth.role === ROLES.OWNER || req.auth.role === ROLES.ADMIN) return next();

    const granted = req.auth.user?.permissions ?? [];
    if (!granted.includes(permission)) {
      return next(
        ApiError.forbidden('Your account does not have this permission', {
          code: 'MISSING_PERMISSION',
          details: { permission },
        }),
      );
    }
    return next();
  };
}

/**
 * Optional authentication for endpoints that behave differently when signed in
 * (e.g. an order lookup that shows more to its owner). Never rejects.
 */
export const optionalAuth = asyncHandler(async (req, res, next) => {
  const token = extractToken(req);
  if (!token) return next();

  try {
    const payload = verifyAccessToken(token);
    const user = await getRepository().findById('users', payload.sub);
    if (user && user.status === 'active') {
      req.auth = { userId: user.id, role: user.role, shopId: user.shopId ?? null, user };
    }
  } catch {
    // A bad token on an optional route simply means "anonymous".
  }
  return next();
});
