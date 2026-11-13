import asyncHandler from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import ApiError from '../utils/ApiError.js';
import {
  machineBreakdown,
  ordersCsv,
  platformSummary,
  shopSummary,
} from '../services/analyticsService.js';

/**
 * Analytics HTTP layer.
 *
 * A shop user's analytics are always their own shop's, whatever they put in the
 * query string. Only an admin may ask for the platform view or name another
 * shop — and even then the id is checked, not trusted.
 */

function daysFrom(req) {
  const days = Number(req.query.days ?? 30);
  if (!Number.isInteger(days) || days < 1 || days > 365) {
    throw ApiError.unprocessable('The reporting range must be 1-365 days', {
      code: 'VALIDATION_ERROR',
      details: { days: 'Must be a whole number between 1 and 365' },
    });
  }
  return days;
}

/** GET /api/analytics/shop — the caller's own shop. */
export const getShopAnalytics = asyncHandler(async (req, res) => {
  const days = daysFrom(req);
  const shopId = req.auth?.shopId;

  if (!shopId) {
    throw ApiError.forbidden('This account is not attached to a shop', { code: 'NO_SHOP' });
  }

  const [summary, machines] = await Promise.all([
    shopSummary(shopId, { days }),
    machineBreakdown(shopId, { days }),
  ]);

  return sendSuccess(res, { ...summary, machines: { ...summary.machines, breakdown: machines } });
});

/** GET /api/analytics/platform — admin only. */
export const getPlatformAnalytics = asyncHandler(async (req, res) => {
  const days = daysFrom(req);
  return sendSuccess(res, await platformSummary({ days }));
});

/** GET /api/analytics/orders.csv — the shop's own orders, as a download. */
export const downloadOrdersCsv = asyncHandler(async (req, res) => {
  const days = daysFrom(req);
  const shopId = req.auth?.shopId;

  if (!shopId) {
    throw ApiError.forbidden('This account is not attached to a shop', { code: 'NO_SHOP' });
  }

  const csv = await ordersCsv(shopId, { days });

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="orders-${new Date().toISOString().slice(0, 10)}.csv"`,
  );
  res.setHeader('Cache-Control', 'no-store');
  // A BOM so Excel opens UTF-8 shop names correctly.
  return res.send(`\uFEFF${csv}`);
});
