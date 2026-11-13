import crypto from 'node:crypto';
import Shop from '../models/Shop.js';
import ApiError from '../utils/ApiError.js';
import { buildPaginationMeta } from '../utils/apiResponse.js';

/**
 * Shop (tenant) services. Kept thin in Phase 2 — the endpoints that need them
 * (shop CRUD, dashboards) arrive with authentication in Phase 3.
 */

/**
 * Generate a short, unambiguous tenant code. Excludes vowels and easily
 * confused characters (0/O, 1/I) because staff read these aloud on the phone.
 */
export function generateShopCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(5);
  let code = '';
  for (let i = 0; i < 5; i += 1) code += alphabet[bytes[i] % alphabet.length];
  return `SH-${code}`;
}

export async function createShop(payload, { createdBy = null } = {}) {
  const emailTaken = await Shop.exists({ email: payload.email });
  if (emailTaken) {
    throw ApiError.conflict('A shop with this email already exists', { code: 'SHOP_EMAIL_TAKEN' });
  }

  const shop = await Shop.create({
    ...payload,
    shopCode: generateShopCode(),
    createdBy,
  });

  return shop;
}

export async function listShops({ page = 1, limit = 20, status, planId, search } = {}) {
  const filter = {};
  if (status) filter.status = status;
  if (planId) filter.planId = planId;
  if (search) {
    const safe = String(search)
      .trim()
      .slice(0, 80)
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { name: { $regex: safe, $options: 'i' } },
      { shopCode: { $regex: safe, $options: 'i' } },
      { 'address.city': { $regex: safe, $options: 'i' } },
    ];
  }

  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
  const safePage = Math.max(1, Number(page) || 1);

  const [items, total] = await Promise.all([
    Shop.find(filter)
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .lean(),
    Shop.countDocuments(filter),
  ]);

  return { items, meta: buildPaginationMeta({ page: safePage, limit: safeLimit, total }) };
}

export async function getShopByIdOrCode(identifier) {
  const isObjectId = /^[a-f\d]{24}$/i.test(String(identifier));
  const shop = await Shop.findOne(
    isObjectId ? { _id: identifier } : { shopCode: String(identifier).toUpperCase() },
  ).lean();

  if (!shop) throw ApiError.notFound('Shop not found', { code: 'SHOP_NOT_FOUND' });
  return shop;
}

export default { createShop, generateShopCode, getShopByIdOrCode, listShops };
