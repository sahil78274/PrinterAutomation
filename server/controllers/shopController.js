import asyncHandler from '../utils/asyncHandler.js';
import { sendCreated, sendSuccess } from '../utils/apiResponse.js';
import { createShop, getShopByIdOrCode, listShops } from '../services/shopService.js';
import { parsePagination } from '../validators/common.js';

/**
 * Admin-only in Phase 3. Kept minimal in Phase 2 so the tenant model can be
 * exercised end-to-end (create a shop → register a machine → resolve its QR).
 */
export const createShopHandler = asyncHandler(async (req, res) => {
  const shop = await createShop(req.body);
  return sendCreated(res, shop);
});

export const listShopsHandler = asyncHandler(async (req, res) => {
  const { page, limit } = parsePagination(req.query);
  const result = await listShops({
    page,
    limit,
    status: req.query.status,
    planId: req.query.planId,
    search: req.query.search,
  });
  return sendSuccess(res, result.items, { meta: result.meta });
});

export const getShopHandler = asyncHandler(async (req, res) => {
  const shop = await getShopByIdOrCode(req.params.identifier);
  return sendSuccess(res, shop);
});
