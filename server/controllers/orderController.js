import asyncHandler from '../utils/asyncHandler.js';
import { sendSuccess, sendCreated } from '../utils/apiResponse.js';
import ApiError from '../utils/ApiError.js';
import * as orderService from '../services/orderService.js';
import { getRepository } from '../repositories/active.js';
import { audit } from '../services/auditService.js';

/**
 * Order HTTP layer.
 *
 * The customer flow is unauthenticated by design — scanning a QR and paying does
 * not require an account — so every order endpoint is scoped by the order's own
 * unguessable id plus, where it matters, the machine it belongs to.
 */

/**
 * POST /api/orders
 *
 * Body: { machineId, documentId, copies, color, sides, paperSize, selectedPages,
 *         idempotencyKey? }
 *
 * The price is computed here from the machine's stored rates. Any `totalPaise`
 * in the body is ignored — there is no code path that reads it.
 */
export const createOrderHandler = asyncHandler(async (req, res) => {
  const repo = getRepository();

  const machine = await repo.findOne('machines', { machineId: req.body.machineId });
  if (!machine) throw ApiError.notFound('Machine not found', { code: 'MACHINE_NOT_FOUND' });

  const document = await repo.findById('documents', req.body.documentId);
  if (!document || document.deletedAt) {
    throw ApiError.notFound('Document not found or expired', { code: 'DOCUMENT_NOT_FOUND' });
  }

  const { order, created } = await orderService.createOrder({
    machine,
    document,
    spec: {
      selectedPages: req.body.selectedPages,
      copies: req.body.copies,
      color: req.body.color,
      sides: req.body.sides,
      paperSize: req.body.paperSize,
    },
    idempotencyKey: req.body.idempotencyKey ?? null,
  });

  await audit(req, {
    action: created ? 'order.created' : 'order.reused',
    entity: 'printOrder',
    entityId: order.id,
    shopId: order.shopId,
    metadata: { machineId: order.machineId, totalPaise: order.totals?.totalPaise },
  });

  const payload = orderService.publicOrder(order);
  return created ? sendCreated(res, payload) : sendSuccess(res, payload);
});

/** GET /api/orders/:orderId — customer tracking. */
export const getOrderHandler = asyncHandler(async (req, res) => {
  const detail = await orderService.getOrderDetail(req.params.orderId);
  return sendSuccess(res, detail);
});

/** POST /api/orders/:orderId/cancel */
export const cancelOrderHandler = asyncHandler(async (req, res) => {
  const order = await orderService.cancelOrder({
    orderId: req.params.orderId,
    reason: req.body?.reason ?? 'Cancelled by customer',
  });
  await audit(req, {
    action: 'order.cancelled',
    entity: 'printOrder',
    entityId: order.id,
    shopId: order.shopId,
  });
  return sendSuccess(res, orderService.publicOrder(order));
});

/** POST /api/orders/:orderId/pay — start a simulated payment. */
export const beginPaymentHandler = asyncHandler(async (req, res) => {
  const result = await orderService.beginPayment({
    orderId: req.params.orderId,
    outcome: req.body?.outcome ?? 'success',
  });
  return sendSuccess(res, result);
});

/**
 * POST /api/orders/:orderId/confirm
 *
 * Confirms payment and authorizes exactly one print job. Repeating it returns
 * the existing job, so a double-clicked button cannot print twice.
 */
export const confirmPaymentHandler = asyncHandler(async (req, res) => {
  const result = await orderService.confirmPayment({
    orderId: req.params.orderId,
    attemptId: req.body?.attemptId ?? null,
    outcome: req.body?.outcome ?? 'success',
    actorId: req.auth?.userId ?? null,
  });

  await audit(req, {
    action: 'order.paid',
    entity: 'printOrder',
    entityId: result.order.id,
    shopId: result.order.shopId,
    metadata: {
      jobId: result.job?.id,
      authorized: result.authorized,
      alreadyPaid: result.alreadyPaid,
      simulated: true,
    },
  });

  return sendSuccess(res, {
    order: orderService.publicOrder(result.order),
    job: result.job
      ? {
          id: result.job.id,
          jobCode: result.job.jobCode,
          status: result.job.status,
          createdAt: result.job.createdAt,
        }
      : null,
    authorized: result.authorized,
    alreadyPaid: result.alreadyPaid,
  });
});

/** GET /api/orders — shop-scoped list for the owner dashboard. */
export const listOrdersHandler = asyncHandler(async (req, res) => {
  const repo = getRepository();
  const shopId = req.shopScope?.shopId ?? req.query.shopId;

  if (!shopId) {
    throw ApiError.badRequest('shopId is required', { code: 'SHOP_REQUIRED' });
  }

  const filter = { shopId };
  if (req.query.status) filter.status = req.query.status;
  if (req.query.machineId) filter.machineId = req.query.machineId;

  const [orders, total] = await Promise.all([
    repo.find('printOrders', filter, {
      page: req.query.page,
      limit: req.query.limit,
      sort: { createdAt: -1 },
    }),
    repo.count('printOrders', filter),
  ]);

  return sendSuccess(res, orders.map(orderService.publicOrder), {
    meta: { total, page: Number(req.query.page ?? 1), limit: Number(req.query.limit ?? 20) },
  });
});
