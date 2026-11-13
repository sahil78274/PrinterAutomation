import asyncHandler from '../utils/asyncHandler.js';
import { sendSuccess, sendCreated } from '../utils/apiResponse.js';
import {
  findMachineForCustomer,
  registerMachine,
  getAcceptanceBlocker,
} from '../services/machineService.js';
import ApiError from '../utils/ApiError.js';
import Machine from '../models/Machine.js';

/**
 * GET /api/machines/:machineId
 *
 * Public, read-only, machine-specific. This is the endpoint the QR portal calls
 * after a scan. It returns exactly what the customer needs and nothing more:
 * no shop contact lists, no revenue, no agent internals.
 */
export const getMachineById = asyncHandler(async (req, res) => {
  const machine = await findMachineForCustomer(req.params.machineId);
  const shop = machine.shopId ?? null;

  const blocker = getAcceptanceBlocker(machine);

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
    pricing: machine.pricing,
    acceptsOrders: blocker === null,
    blockedReason: blocker,
    shop: shop
      ? {
          id: shop._id,
          shopCode: shop.shopCode,
          name: shop.name,
          address: shop.address,
          phone: shop.phone,
          openHours: shop.openHours,
          rating: shop.rating,
          reviewCount: shop.reviewCount,
        }
      : null,
  });
});

/**
 * POST /api/machines
 *
 * Admin-only in Phase 3. Until authentication exists, this route is mounted
 * behind an explicit guard that refuses the request unless
 * ALLOW_ANONYMOUS_ADMIN is enabled for local development — so the endpoint
 * cannot silently become an open machine-creation API.
 */
export const createMachine = asyncHandler(async (req, res) => {
  const machine = await registerMachine({
    shopId: req.body.shopId,
    name: req.body.name,
    printer: req.body.printer,
    pricing: req.body.pricing,
  });

  return sendCreated(res, {
    machineId: machine.machineId,
    name: machine.name,
    shopId: machine.shopId,
    shopName: machine.shopName,
    status: machine.status,
    qrPath: machine.qrPath,
    printer: machine.printer,
    pricing: machine.pricing,
    createdAt: machine.createdAt,
  });
});

/**
 * GET /api/machines
 *
 * List machines, always scoped to a shop. Admin-wide listing arrives with auth;
 * requiring `shopId` here prevents an accidental cross-tenant dump.
 */
export const listMachines = asyncHandler(async (req, res) => {
  const { shopId, status } = req.query;

  if (!shopId) {
    throw ApiError.badRequest('shopId query parameter is required', {
      code: 'SHOP_ID_REQUIRED',
    });
  }

  const filter = { shopId };
  if (status) filter.status = status;

  const machines = await Machine.find(filter).sort({ machineId: 1 }).lean();

  return sendSuccess(res, machines, { meta: { total: machines.length } });
});
