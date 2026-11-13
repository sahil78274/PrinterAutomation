import asyncHandler from '../utils/asyncHandler.js';
import { sendSuccess, sendCreated } from '../utils/apiResponse.js';
import ApiError from '../utils/ApiError.js';
import {
  findMachineForCustomer,
  getAcceptanceBlocker,
  publicMachine,
  registerMachine,
  rotateQrToken,
} from '../services/machineService.js';
import { getRepository } from '../repositories/active.js';
import { audit } from '../services/auditService.js';

/**
 * Machine HTTP layer.
 *
 * Three very different audiences:
 *   - the customer QR portal (public, minimal data, one machine)
 *   - the shop dashboard (authenticated, tenant-scoped)
 *   - the admin console (cross-tenant)
 */

/**
 * GET /api/machines/:machineId
 *
 * Public. This is what the QR portal calls after a scan, so it returns exactly
 * what a customer needs and nothing more: no agent internals, no revenue, no
 * other machines, no shop contact lists beyond what a walk-in needs.
 */
export const getMachineById = asyncHandler(async (req, res) => {
  const machine = await findMachineForCustomer(req.params.machineId);
  const shop = machine.shop ?? null;
  const blocker = getAcceptanceBlocker(machine, shop);

  return sendSuccess(res, {
    machineId: machine.machineId,
    name: machine.name,
    status: machine.status,
    qrPath: machine.qrPath,
    printer: {
      model: machine.printer?.model ?? null,
      supportsColor: Boolean(machine.printer?.supportsColor),
      supportsDuplex: Boolean(machine.printer?.supportsDuplex),
      maxPaperSize: machine.printer?.maxPaperSize ?? 'A4',
      paperSizes: machine.printer?.paperSizes ?? ['A4'],
    },
    // The customer must be able to see the price before uploading.
    pricing: machine.pricing,
    acceptsOrders: blocker === null,
    blockedReason: blocker,
    shop: shop
      ? {
          id: shop.id,
          shopCode: shop.shopCode,
          name: shop.name,
          address: shop.address,
          phone: shop.phone,
          openHours: shop.openHours,
          status: shop.status,
          rating: shop.rating ?? null,
          reviewCount: shop.reviewCount ?? 0,
        }
      : null,
  });
});

/**
 * POST /api/machines
 *
 * Owner or admin. The shop must come from the caller's own scope for an owner —
 * `resolveShopScope` in the route already proves that — and the server assigns
 * the machine id, QR path and QR token.
 */
export const createMachine = asyncHandler(async (req, res) => {
  const shopId = req.shopScope?.shopId ?? req.body.shopId;

  const machine = await registerMachine({
    shopId,
    name: req.body.name,
    printer: req.body.printer,
    pricing: req.body.pricing,
  });

  await audit(req, {
    action: 'machine.registered',
    entity: 'machine',
    entityId: machine.id,
    shopId,
    metadata: { machineId: machine.machineId },
  });

  return sendCreated(res, {
    id: machine.id,
    machineId: machine.machineId,
    name: machine.name,
    shopId: machine.shopId,
    shopName: machine.shopName,
    status: machine.status,
    qrPath: machine.qrPath,
    // The token is returned so the QR can be rendered; it is not a secret in the
    // same sense as an agent key — its purpose is to be scannable.
    qrToken: machine.qrToken,
    printer: machine.printer,
    pricing: machine.pricing,
    createdAt: machine.createdAt,
  });
});

/**
 * GET /api/machines
 *
 * Shop-scoped listing. `shopId` is required rather than optional so a missing
 * filter can never turn into a cross-tenant dump.
 */
export const listMachines = asyncHandler(async (req, res) => {
  const repo = getRepository();
  const shopId = req.shopScope?.shopId ?? req.query.shopId;

  if (!shopId) {
    throw ApiError.badRequest('shopId query parameter is required', {
      code: 'SHOP_ID_REQUIRED',
    });
  }

  const filter = { shopId };
  if (req.query.status) filter.status = req.query.status;

  const machines = await repo.findAll('machines', filter, { sort: { machineId: 1 } });

  return sendSuccess(res, machines.map(publicMachine), { meta: { total: machines.length } });
});

/** GET /api/machines/:machineId/detail — authenticated, for the shop dashboard. */
export const getMachineDetail = asyncHandler(async (req, res) => {
  const repo = getRepository();
  const shopId = req.shopScope?.shopId ?? req.auth?.shopId;

  const machine = await repo.findOne('machines', {
    machineId: req.params.machineId,
    ...(req.auth?.role === 'admin' ? {} : { shopId }),
  });
  if (!machine) throw ApiError.notFound('Machine not found', { code: 'MACHINE_NOT_FOUND' });

  const agent = await repo.findOne('printAgents', { machineId: machine.machineId });
  const jobCounts = await Promise.all([
    repo.count('printJobs', { machineId: machine.machineId }),
    repo.count('printJobs', { machineId: machine.machineId, status: 'FAILED' }),
  ]);

  return sendSuccess(res, {
    ...publicMachine(machine),
    qrToken: machine.qrToken,
    agent: agent
      ? {
          agentId: agent.agentId,
          printMode: agent.printMode,
          online: Boolean(agent.lastSeenAt),
          lastSeenAt: agent.lastSeenAt,
        }
      : null,
    stats: { totalJobs: jobCounts[0], failedJobs: jobCounts[1] },
  });
});

/**
 * POST /api/machines/:machineId/qr/rotate
 *
 * Invalidates every previously printed QR for the machine. Owner or admin only.
 */
export const rotateQrHandler = asyncHandler(async (req, res) => {
  const shopId = req.shopScope?.shopId ?? req.auth?.shopId;
  const machine = await rotateQrToken({
    machineId: req.params.machineId,
    shopId,
    actorId: req.auth?.userId ?? null,
  });

  await audit(req, {
    action: 'machine.qr_rotated',
    entity: 'machine',
    entityId: machine.id,
    shopId,
    metadata: { machineId: machine.machineId, version: machine.qrTokenVersion },
  });

  return sendSuccess(res, {
    machineId: machine.machineId,
    qrPath: machine.qrPath,
    qrToken: machine.qrToken,
    qrTokenVersion: machine.qrTokenVersion,
  });
});

/** PATCH /api/machines/:machineId/status — activate/deactivate. */
export const updateMachineStatus = asyncHandler(async (req, res) => {
  const repo = getRepository();
  const shopId = req.shopScope?.shopId ?? req.auth?.shopId;

  const machine = await repo.findOne('machines', { machineId: req.params.machineId, shopId });
  if (!machine) throw ApiError.notFound('Machine not found', { code: 'MACHINE_NOT_FOUND' });

  const allowed = ['online', 'offline', 'maintenance'];
  if (!allowed.includes(req.body.status)) {
    throw ApiError.unprocessable('Invalid machine status', {
      code: 'VALIDATION_ERROR',
      details: { status: `Must be one of: ${allowed.join(', ')}` },
    });
  }

  const updated = await repo.updateById('machines', machine.id, { status: req.body.status });

  await audit(req, {
    action: 'machine.status_changed',
    entity: 'machine',
    entityId: machine.id,
    shopId,
    metadata: { from: machine.status, to: req.body.status },
  });

  return sendSuccess(res, publicMachine(updated));
});

/**
 * PATCH /api/machines/:machineId/pricing
 *
 * Repricing is an owner-level action (staff may hold the permission, but it is
 * checked in the route). Prices are integer paise and are never allowed negative.
 */
export const updateMachinePricing = asyncHandler(async (req, res) => {
  const repo = getRepository();
  const shopId = req.shopScope?.shopId ?? req.auth?.shopId;

  const machine = await repo.findOne('machines', { machineId: req.params.machineId, shopId });
  if (!machine) throw ApiError.notFound('Machine not found', { code: 'MACHINE_NOT_FOUND' });

  const fields = [
    'bwSinglePaise',
    'bwDoublePaise',
    'colorSinglePaise',
    'colorDoublePaise',
    'minimumChargePaise',
  ];

  const patch = {};
  const errors = {};
  for (const field of fields) {
    if (req.body[field] === undefined) continue;
    const value = Number(req.body[field]);
    if (!Number.isInteger(value) || value < 0 || value > 100_000) {
      errors[field] = 'Must be a whole number of paise between 0 and 100000';
    } else {
      patch[field] = value;
    }
  }

  if (Object.keys(errors).length) {
    throw ApiError.unprocessable('Some prices are not valid', {
      code: 'VALIDATION_ERROR',
      details: errors,
    });
  }
  if (!Object.keys(patch).length) {
    throw ApiError.badRequest('No prices were provided', { code: 'NO_CHANGES' });
  }

  // A mono machine cannot have a colour rate.
  if (!machine.printer?.supportsColor) {
    if (patch.colorSinglePaise > 0 || patch.colorDoublePaise > 0) {
      throw ApiError.unprocessable('This machine cannot print in colour', {
        code: 'COLOR_UNSUPPORTED',
        details: { color: 'Colour rates cannot be set on a black-and-white printer' },
      });
    }
  }

  const updated = await repo.updateById('machines', machine.id, {
    pricing: { ...machine.pricing, ...patch },
  });

  await audit(req, {
    action: 'machine.pricing_updated',
    entity: 'machine',
    entityId: machine.id,
    shopId,
    metadata: { changed: patch },
  });

  return sendSuccess(res, publicMachine(updated));
});

/** GET /api/machines/:machineId/qr — SVG QR payload for the printed sticker. */
export const getMachineQr = asyncHandler(async (req, res) => {
  const repo = getRepository();
  const machine = await repo.findOne('machines', { machineId: req.params.machineId });
  if (!machine) throw ApiError.notFound('Machine not found', { code: 'MACHINE_NOT_FOUND' });

  return sendSuccess(res, {
    machineId: machine.machineId,
    qrPath: machine.qrPath,
    qrToken: machine.qrToken,
    qrTokenVersion: machine.qrTokenVersion ?? 1,
  });
});
