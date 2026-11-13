import asyncHandler from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import ApiError from '../utils/ApiError.js';
import { getRepository, getRepositoryKind } from '../repositories/active.js';
import { publicUser } from '../services/staffService.js';
import { publicShop, setShopStatus } from '../services/shopService.js';
import { publicPlan, PLANS } from '../services/subscriptionService.js';
import { isAgentOnline, publicAgent } from '../services/agentService.js';
import { audit } from '../services/auditService.js';

/**
 * Platform administration. Super-admin only; every route is behind
 * `requireAdmin`, and `requireAdmin` re-reads the JWT's role claim rather than
 * trusting anything client-supplied.
 */

/** GET /api/admin/users — every account, filterable. */
export const listUsersHandler = asyncHandler(async (req, res) => {
  const repo = getRepository();
  const filter = {};
  if (req.query.role) filter.role = String(req.query.role);
  if (req.query.shopId) filter.shopId = String(req.query.shopId);
  if (req.query.status) filter.status = String(req.query.status);
  if (req.query.search) filter.search = String(req.query.search).trim().slice(0, 80);

  const [users, total] = await Promise.all([
    repo.find('users', filter, {
      page: req.query.page,
      limit: req.query.limit,
      sort: { createdAt: -1 },
    }),
    repo.count('users', filter),
  ]);

  return sendSuccess(res, users.map(publicUser), {
    meta: { total, page: Number(req.query.page ?? 1), limit: Number(req.query.limit ?? 20) },
  });
});

/**
 * PATCH /api/admin/users/:userId/status
 *
 * Suspend or reactivate any account. An admin cannot suspend themselves, which
 * would otherwise be an easy way to lock the platform out of its own console.
 */
export const updateUserStatusHandler = asyncHandler(async (req, res) => {
  const repo = getRepository();
  const user = await repo.findById('users', req.params.userId);
  if (!user) throw ApiError.notFound('User not found', { code: 'USER_NOT_FOUND' });

  if (user.id === req.auth.userId) {
    throw ApiError.forbidden('You cannot change the status of your own account', {
      code: 'SELF_MODIFICATION_DENIED',
    });
  }

  const status = String(req.body.status ?? '');
  if (!['active', 'suspended'].includes(status)) {
    throw ApiError.unprocessable('Invalid account status', {
      code: 'VALIDATION_ERROR',
      details: { status: "Must be 'active' or 'suspended'" },
    });
  }

  // Suspend: revoke sessions so the change takes effect immediately.
  if (status === 'suspended') {
    const tokens = await repo.findAll('refreshTokens', { userId: user.id, revokedAt: null });
    await Promise.all(
      tokens.map((token) =>
        repo.updateById('refreshTokens', token.id, {
          revokedAt: new Date().toISOString(),
          revokedReason: 'admin_suspended',
        }),
      ),
    );
  }

  const updated = await repo.updateById('users', user.id, {
    status,
    statusChangedAt: new Date().toISOString(),
    statusChangedBy: req.auth.userId,
  });

  await audit(req, {
    action: 'admin.user_status_changed',
    entity: 'user',
    entityId: user.id,
    shopId: user.shopId ?? null,
    metadata: { from: user.status, to: status },
  });

  return sendSuccess(res, publicUser(updated));
});

/** GET /api/admin/shops — every shop with its plan and machine count. */
export const listAllShopsHandler = asyncHandler(async (req, res) => {
  const repo = getRepository();
  const filter = {};
  if (req.query.status) filter.status = String(req.query.status);

  const [shops, total] = await Promise.all([
    repo.find('shops', filter, {
      page: req.query.page,
      limit: req.query.limit,
      sort: { createdAt: -1 },
    }),
    repo.count('shops', filter),
  ]);

  return sendSuccess(
    res,
    shops.map((shop) => ({
      ...publicShop(shop),
      plan: PLANS[shop.planId] ? publicPlan(PLANS[shop.planId]) : null,
    })),
    { meta: { total, page: Number(req.query.page ?? 1), limit: Number(req.query.limit ?? 20) } },
  );
});

/** PATCH /api/admin/shops/:shopId/status */
export const updateShopStatusHandler = asyncHandler(async (req, res) => {
  const updated = await setShopStatus(req.params.shopId, req.body.status, {
    actorId: req.auth.userId,
    reason: req.body.reason ?? null,
  });

  await audit(req, {
    action: 'admin.shop_status_changed',
    entity: 'shop',
    entityId: updated.id,
    shopId: updated.id,
    metadata: { to: req.body.status, reason: req.body.reason ?? null },
  });

  return sendSuccess(res, publicShop(updated));
});

/** GET /api/admin/agents — every registered print agent and its liveness. */
export const listAgentsHandler = asyncHandler(async (req, res) => {
  const repo = getRepository();
  const filter = req.query.shopId ? { shopId: String(req.query.shopId) } : {};

  const agents = await repo.findAll('printAgents', filter, { sort: { createdAt: -1 } });

  return sendSuccess(
    res,
    agents.map((agent) => ({
      ...publicAgent(agent),
      // Computed at read time: a stored "online" flag is wrong the moment the
      // agent dies, and there is nobody to flip it.
      online: isAgentOnline(agent),
    })),
    { meta: { total: agents.length } },
  );
});

/** GET /api/admin/audit — recent audit entries, newest first. */
export const listAuditHandler = asyncHandler(async (req, res) => {
  const repo = getRepository();
  const filter = {};
  if (req.query.shopId) filter.shopId = String(req.query.shopId);
  if (req.query.action) filter.action = String(req.query.action);
  if (req.query.entity) filter.entity = String(req.query.entity);

  const [logs, total] = await Promise.all([
    repo.find('auditLogs', filter, {
      page: req.query.page,
      limit: req.query.limit ?? 50,
      sort: { at: -1 },
    }),
    repo.count('auditLogs', filter),
  ]);

  return sendSuccess(res, logs, {
    meta: { total, page: Number(req.query.page ?? 1), limit: Number(req.query.limit ?? 50) },
  });
});

/** GET /api/admin/system — what this deployment is actually configured to do. */
export const systemInfoHandler = asyncHandler(async (req, res) => {
  return sendSuccess(res, {
    // Which storage adapter is actually serving this request. A dashboard that
    // shows "MongoDB" while running on memory would be actively misleading.
    repository: getRepositoryKind(),
    // The honesty flag that matters most: this deployment cannot take real money.
    payments: {
      provider: 'development',
      simulated: true,
      productionReady: false,
    },
    printing: {
      // Printing requires the Windows agent and a real installed printer.
      virtualModeAvailable: true,
      physicalPrintingVerified: false,
      note: 'Physical printing requires the Local Print Agent and a real, installed printer. It has not been verified in this environment.',
    },
  });
});
