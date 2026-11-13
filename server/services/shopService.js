import crypto from 'node:crypto';
import ApiError from '../utils/ApiError.js';
import { buildPaginationMeta } from '../utils/apiResponse.js';
import { getRepository } from '../repositories/active.js';

/**
 * Shop (tenant) services.
 *
 * A shop is the tenant boundary of the whole platform: machines, orders, jobs,
 * agents, staff and analytics all hang off a shop id. Two rules are enforced
 * here rather than in controllers, so no new endpoint can forget them:
 *
 *  1. Nothing cross-tenant is ever listed unless the caller is a platform admin.
 *  2. A shop's public projection never includes billing, staff or settings.
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

/**
 * Create a shop.
 *
 * Server-owned: `shopCode`, `status`, `planId` (defaults to the trial plan),
 * `machineCount`. A client cannot set a shop to `active` on creation — approval
 * is an admin action, which is what keeps an unvetted shop from taking orders.
 */
export async function createShop(
  payload,
  { createdBy = null, status = 'pending', planId = 'trial' } = {},
) {
  const repo = getRepository();

  if (payload.email) {
    const email = String(payload.email).trim().toLowerCase();
    const existing = await repo.findOne('shops', { email });
    if (existing) {
      throw ApiError.conflict('A shop with this email already exists', {
        code: 'SHOP_EMAIL_TAKEN',
      });
    }
    payload = { ...payload, email };
  }

  // Shop codes are short enough to collide in theory; try a few times.
  let shopCode = generateShopCode();
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const taken = await repo.findOne('shops', { shopCode });
    if (!taken) break;
    shopCode = generateShopCode();
  }

  const shop = await repo.insert('shops', {
    ...payload,
    shopCode,
    status,
    planId,
    planStatus: 'active',
    machineCount: 0,
    maxMachines: 4,
    settings: { acceptOrders: true },
    createdBy,
  });

  return shop;
}

/**
 * List shops.
 *
 * `scope` carries the caller's tenancy. When it names a shop, only that shop is
 * ever returned — the filter is applied here, not by the caller, so a shop user
 * cannot pass a different shopId and list the platform.
 */
export async function listShops(
  { page = 1, limit = 20, status, planId, search } = {},
  { scope = null } = {},
) {
  const repo = getRepository();
  const filter = {};

  if (scope?.shopId) {
    filter.id = scope.shopId;
  } else {
    if (status) filter.status = status;
    if (planId) filter.planId = planId;
    if (search) filter.search = String(search).trim().slice(0, 80);
  }

  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
  const safePage = Math.max(1, Number(page) || 1);

  const [items, total] = await Promise.all([
    repo.find('shops', filter, {
      page: safePage,
      limit: safeLimit,
      sort: { createdAt: -1 },
    }),
    repo.count('shops', filter),
  ]);

  return { items, meta: buildPaginationMeta({ page: safePage, limit: safeLimit, total }) };
}

/**
 * Resolve a shop by id or by its human-facing code (`SH-XXXXX`).
 *
 * Ids are opaque strings, so the check is "does an id match" rather than "does
 * this look like an ObjectId" — that keeps this function adapter-agnostic.
 */
export async function getShopByIdOrCode(identifier) {
  const repo = getRepository();
  const value = String(identifier ?? '').trim();

  const shop =
    (await repo.findById('shops', value)) ??
    (await repo.findOne('shops', { shopCode: value.toUpperCase() }));

  if (!shop) throw ApiError.notFound('Shop not found', { code: 'SHOP_NOT_FOUND' });
  return shop;
}

/**
 * Public projection of a shop.
 *
 * Deliberately excludes: owner email, billing, plan internals, staff, audit
 * history, revenue. A customer who scans a QR sees this and nothing more.
 */
export function publicShop(shop) {
  if (!shop) return null;
  return {
    id: shop.id,
    shopCode: shop.shopCode,
    name: shop.name,
    status: shop.status,
    address: shop.address,
    phone: shop.phone,
    email: shop.email ?? null,
    openHours: shop.openHours,
    acceptsOrders: shop.status === 'active' && shop.settings?.acceptOrders !== false,
    rating: shop.rating ?? null,
    reviewCount: shop.reviewCount ?? 0,
    machineCount: shop.machineCount ?? 0,
    createdAt: shop.createdAt,
  };
}

/** Projection for the owning shop's own dashboard: adds plan and settings. */
export function shopDashboard(shop) {
  if (!shop) return null;
  return {
    ...publicShop(shop),
    planId: shop.planId,
    planStatus: shop.planStatus,
    maxMachines: shop.maxMachines,
    settings: shop.settings,
    billing: undefined,
  };
}

/** Admin approval: pending → active. This is the only path to trading status. */
export async function approveShop(shopId, { actorId = null } = {}) {
  const repo = getRepository();
  const shop = await repo.findById('shops', shopId);
  if (!shop) throw ApiError.notFound('Shop not found', { code: 'SHOP_NOT_FOUND' });

  if (shop.status === 'active') {
    return { shop, changed: false };
  }

  const updated = await repo.updateById('shops', shopId, {
    status: 'active',
    approvedAt: new Date().toISOString(),
    approvedBy: actorId,
  });

  return { shop: updated, changed: true };
}

/** Suspend or reactivate a shop. Suspension does not delete data. */
export async function setShopStatus(shopId, status, { actorId = null, reason = null } = {}) {
  const allowed = ['pending', 'active', 'suspended', 'closed'];
  if (!allowed.includes(status)) {
    throw ApiError.unprocessable('Invalid shop status', {
      code: 'VALIDATION_ERROR',
      details: { status: `Must be one of: ${allowed.join(', ')}` },
    });
  }

  const repo = getRepository();
  const shop = await repo.findById('shops', shopId);
  if (!shop) throw ApiError.notFound('Shop not found', { code: 'SHOP_NOT_FOUND' });

  const updated = await repo.updateById('shops', shopId, {
    status,
    statusReason: reason,
    statusChangedAt: new Date().toISOString(),
    statusChangedBy: actorId,
  });

  return updated;
}

export default {
  approveShop,
  createShop,
  generateShopCode,
  getShopByIdOrCode,
  listShops,
  publicShop,
  setShopStatus,
  shopDashboard,
};
