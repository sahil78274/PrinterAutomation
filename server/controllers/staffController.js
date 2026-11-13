import asyncHandler from '../utils/asyncHandler.js';
import { sendCreated, sendSuccess } from '../utils/apiResponse.js';
import ApiError from '../utils/ApiError.js';
import {
  createStaff,
  deactivateStaff,
  listStaff,
  publicUser,
  updateStaff,
} from '../services/staffService.js';
import { audit } from '../services/auditService.js';

/**
 * Staff management HTTP layer. Owner-only, always within the owner's own shop.
 */

function requireOwnShop(req) {
  if (!req.auth?.shopId) {
    throw ApiError.forbidden('This account is not attached to a shop', { code: 'NO_SHOP' });
  }
  return req.auth.shopId;
}

/** GET /api/staff */
export const listStaffHandler = asyncHandler(async (req, res) => {
  const staff = await listStaff(requireOwnShop(req));
  return sendSuccess(res, staff, { meta: { total: staff.length } });
});

/**
 * POST /api/staff
 *
 * The shop is the owner's own — a `shopId` in the body is ignored, so an owner
 * cannot create an account inside someone else's shop.
 */
export const createStaffHandler = asyncHandler(async (req, res) => {
  const shopId = requireOwnShop(req);

  const user = await createStaff(
    {
      shopId,
      name: req.body.name,
      email: req.body.email,
      password: req.body.password,
      permissions: req.body.permissions,
    },
    { actorId: req.auth.userId },
  );

  await audit(req, {
    action: 'staff.created',
    entity: 'user',
    entityId: user.id,
    shopId,
    metadata: { role: user.role, permissions: user.permissions },
  });

  return sendCreated(res, publicUser(user));
});

/** PATCH /api/staff/:userId */
export const updateStaffHandler = asyncHandler(async (req, res) => {
  const shopId = requireOwnShop(req);

  const user = await updateStaff(shopId, req.params.userId, req.body, {
    actorId: req.auth.userId,
  });

  await audit(req, {
    action: 'staff.updated',
    entity: 'user',
    entityId: user.id,
    shopId,
    metadata: { fields: Object.keys(req.body ?? {}) },
  });

  return sendSuccess(res, publicUser(user));
});

/** DELETE /api/staff/:userId — deactivates, never deletes. */
export const deactivateStaffHandler = asyncHandler(async (req, res) => {
  const shopId = requireOwnShop(req);

  const user = await deactivateStaff(shopId, req.params.userId, { actorId: req.auth.userId });

  await audit(req, {
    action: 'staff.deactivated',
    entity: 'user',
    entityId: user.id,
    shopId,
  });

  return sendSuccess(res, publicUser(user));
});

/** GET /api/staff/permissions — the vocabulary, so the UI cannot drift. */
export const listPermissionsHandler = asyncHandler(async (req, res) => {
  const { ALL_PERMISSIONS } = await import('../services/staffService.js');
  return sendSuccess(res, ALL_PERMISSIONS);
});
