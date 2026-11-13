import asyncHandler from '../utils/asyncHandler.js';
import { sendCreated, sendSuccess } from '../utils/apiResponse.js';
import ApiError from '../utils/ApiError.js';
import {
  approveShop,
  createShop,
  getShopByIdOrCode,
  listShops,
  publicShop,
  setShopStatus,
  shopDashboard,
} from '../services/shopService.js';
import { parsePagination } from '../validators/common.js';
import { audit } from '../services/auditService.js';
import { getRepository } from '../repositories/active.js';
import { publicMachine } from '../services/machineService.js';

/**
 * Shop HTTP layer.
 *
 * Access rules, enforced here and in the routes:
 *   - admin: every shop, plus approval and status changes
 *   - owner/staff: their own shop only, via `req.shopScope`
 *   - anonymous: nothing
 */

/** POST /api/shops — admin only. New shops start `pending`, not `active`. */
export const createShopHandler = asyncHandler(async (req, res) => {
  const shop = await createShop(req.body, {
    createdBy: req.auth?.userId ?? null,
    status: 'pending',
    planId: req.body.planId ?? 'trial',
  });

  await audit(req, {
    action: 'shop.created',
    entity: 'shop',
    entityId: shop.id,
    shopId: shop.id,
    metadata: { shopCode: shop.shopCode },
  });

  return sendCreated(res, shopDashboard(shop));
});

/**
 * GET /api/shops
 *
 * Admin: the platform list. Owner/staff: their own shop, regardless of what
 * they pass in the query string — tenancy comes from the token.
 */
export const listShopsHandler = asyncHandler(async (req, res) => {
  const { page, limit } = parsePagination(req.query);
  const scope = req.auth?.role === 'admin' ? null : { shopId: req.auth?.shopId };

  if (!scope && req.auth?.role !== 'admin') {
    throw ApiError.forbidden('You do not have access to the platform shop list', {
      code: 'FORBIDDEN',
    });
  }

  const result = await listShops(
    {
      page,
      limit,
      status: req.query.status,
      planId: req.query.planId,
      search: req.query.search,
    },
    { scope },
  );

  const projection = req.auth?.role === 'admin' ? shopDashboard : publicShop;
  return sendSuccess(res, result.items.map(projection), { meta: result.meta });
});

/** GET /api/shops/:identifier — own shop, or any shop for an admin. */
export const getShopHandler = asyncHandler(async (req, res) => {
  const shop = await getShopByIdOrCode(req.params.identifier);

  const isAdmin = req.auth?.role === 'admin';
  const isOwnShop = String(shop.id) === String(req.auth?.shopId);
  if (!isAdmin && !isOwnShop) {
    // 404, not 403: the existence of another tenant is not this caller's business.
    throw ApiError.notFound('Shop not found', { code: 'SHOP_NOT_FOUND' });
  }

  return sendSuccess(res, isAdmin ? shopDashboard(shop) : shopDashboard(shop));
});

/** GET /api/shops/me — the caller's own shop, with its machines. */
export const getMyShopHandler = asyncHandler(async (req, res) => {
  if (!req.auth?.shopId) {
    throw ApiError.forbidden('This account is not attached to a shop', { code: 'NO_SHOP' });
  }

  const shop = await getShopByIdOrCode(req.auth.shopId);
  const repo = getRepository();
  const machines = await repo.findAll('machines', { shopId: shop.id }, { sort: { machineId: 1 } });

  return sendSuccess(res, {
    ...shopDashboard(shop),
    machines: machines.map(publicMachine),
  });
});

/** POST /api/shops/:identifier/approve — admin only. */
export const approveShopHandler = asyncHandler(async (req, res) => {
  const shop = await getShopByIdOrCode(req.params.identifier);
  const { shop: updated, changed } = await approveShop(shop.id, {
    actorId: req.auth?.userId ?? null,
  });

  await audit(req, {
    action: changed ? 'shop.approved' : 'shop.approve_noop',
    entity: 'shop',
    entityId: updated.id,
    shopId: updated.id,
  });

  return sendSuccess(res, shopDashboard(updated), { meta: { changed } });
});

/** PATCH /api/shops/:identifier/status — admin only. */
export const updateShopStatusHandler = asyncHandler(async (req, res) => {
  const shop = await getShopByIdOrCode(req.params.identifier);
  const updated = await setShopStatus(shop.id, req.body.status, {
    actorId: req.auth?.userId ?? null,
    reason: req.body.reason ?? null,
  });

  await audit(req, {
    action: 'shop.status_changed',
    entity: 'shop',
    entityId: updated.id,
    shopId: updated.id,
    metadata: { from: shop.status, to: req.body.status, reason: req.body.reason ?? null },
  });

  return sendSuccess(res, shopDashboard(updated));
});
