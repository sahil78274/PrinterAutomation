import { randomUUID } from 'node:crypto';
import ApiError from '../utils/ApiError.js';
import config from '../config/index.js';
import { getRepository } from '../repositories/active.js';
import { normalisePrintRequest, quote } from './pricingEngine.js';
import { createJobForOrder, publicJob } from './printJobService.js';
import { getPaymentProvider } from './payments/provider.js';
import { publicDocument } from './documentService.js';
import { emitToShop, emitToOrder, emitToAdmins } from './realtimeService.js';

/**
 * Orders.
 *
 * An order is the customer's purchase: a document, a print specification, a
 * price, and a payment. It is created *before* payment and only becomes
 * printable once payment succeeds.
 *
 * ## Price integrity
 *
 * The client sends a print specification, never a price. `createOrder` recomputes
 * the quote server-side from the machine's stored rates. If a client sends a
 * `totalPaise` it is ignored entirely — there is no code path that reads it.
 *
 * ## Exactly one job
 *
 * `payOrder` creates the print job once and records `jobId` on the order. A
 * repeated confirmation returns the existing job rather than queueing a second
 * print, which is what makes a double-clicked "Pay" button safe.
 */

export const ORDER_STATUS = Object.freeze({
  AWAITING_PAYMENT: 'awaiting_payment',
  PAID: 'paid',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded',
});

function orderCode() {
  const stamp = Date.now().toString(36).toUpperCase().slice(-5);
  const random = randomUUID().slice(0, 3).toUpperCase();
  return `SPO-${stamp}${random}`;
}

/**
 * Create an order from a validated document and a print specification.
 *
 * @param {object} params
 * @param {object} params.machine       Machine being ordered from (authoritative)
 * @param {object} params.document      Stored document record
 * @param {object} params.spec          colour/sides/copies/selectedPages/paperSize
 * @param {string} [params.idempotencyKey] Client-supplied; a repeat returns the first order
 */
export async function createOrder({ machine, document, spec, idempotencyKey = null }) {
  const repo = getRepository();

  if (!machine) throw ApiError.badRequest('A machine is required', { code: 'MACHINE_REQUIRED' });
  if (!document) throw ApiError.badRequest('A document is required', { code: 'DOCUMENT_REQUIRED' });

  if (String(document.shopId) !== String(machine.shopId)) {
    // A document uploaded for one shop must not be ordered at another's machine.
    throw ApiError.forbidden('That document does not belong to this shop', {
      code: 'DOCUMENT_SHOP_MISMATCH',
    });
  }

  if (idempotencyKey) {
    const existing = await repo.findOne('printOrders', { idempotencyKey });
    if (existing) return { order: existing, created: false, quote: existing.quote };
  }

  const request = normalisePrintRequest({
    pageCount: document.pageCount,
    selectedPages: spec.selectedPages,
    copies: spec.copies,
    color: spec.color,
    sides: spec.sides,
    paperSize: spec.paperSize,
  });

  const priced = quote({
    machine,
    request,
    platformFeeBps: config.payments.platformFeeBps,
  });

  // The order is only creatable when the machine can actually take it.
  if (machine.status === 'offline' || machine.status === 'maintenance') {
    throw ApiError.conflict('This machine is not accepting orders right now', {
      code: 'MACHINE_UNAVAILABLE',
      details: { machineStatus: machine.status },
    });
  }

  const order = await repo.insert('printOrders', {
    orderCode: orderCode(),
    shopId: machine.shopId,
    machineId: machine.machineId,
    machineRef: machine.id,
    documentId: document.id,
    documentName: document.originalName,
    pageCount: document.pageCount,
    selectedPages: request.pages.length === request.totalPages ? null : request.pages.join(','),
    copies: request.copies,
    color: request.color,
    sides: request.sides,
    paperSize: request.paperSize,
    quote: priced,
    // Denormalised so accounting does not depend on re-running the engine.
    totals: {
      subtotalPaise: priced.subtotalPaise,
      platformFeePaise: priced.platformFeePaise,
      totalPaise: priced.totalPaise,
      currency: 'INR',
    },
    status: ORDER_STATUS.AWAITING_PAYMENT,
    paymentStatus: 'pending',
    paidAt: null,
    jobId: null,
    idempotencyKey,
    simulated: true, // every payment in this build is simulated
    createdAt: new Date().toISOString(),
  });

  emitToShop(order.shopId, 'order:created', publicOrder(order));
  emitToAdmins('order:created', publicOrder(order));

  return { order, created: true, quote: priced };
}

/**
 * Start a (simulated) payment.
 *
 * Returns an intent the client confirms. Nothing is authorized here — that is
 * deliberate, because a real gateway's intent step never proves payment either.
 */
export async function beginPayment({ orderId, outcome = 'success' }) {
  const repo = getRepository();
  const order = await repo.findById('printOrders', orderId);
  if (!order) throw ApiError.notFound('Order not found', { code: 'ORDER_NOT_FOUND' });

  if (order.status === ORDER_STATUS.PAID) {
    throw ApiError.conflict('This order is already paid', { code: 'ORDER_ALREADY_PAID' });
  }
  if (order.status === ORDER_STATUS.CANCELLED) {
    throw ApiError.conflict('This order was cancelled', { code: 'ORDER_CANCELLED' });
  }

  const provider = getPaymentProvider();
  const intent = await provider.createIntent({
    order,
    amountPaise: order.totals.totalPaise,
    idempotencyKey: `${order.id}:${order.totals.totalPaise}`,
    outcome,
  });

  const attempt = await repo.insert('paymentAttempts', {
    orderId: order.id,
    shopId: order.shopId,
    provider: provider.name,
    providerPaymentId: intent.providerPaymentId,
    amountPaise: intent.amountPaise,
    currency: 'INR',
    status: 'created',
    idempotencyKey: intent.idempotencyKey,
    simulated: true,
    createdAt: new Date().toISOString(),
  });

  return { intent, attemptId: attempt.id };
}

/**
 * Confirm a payment and, on success, authorize exactly one print job.
 *
 * This is the pivot of the whole product. Everything before it is paperwork;
 * everything after it is physical. Two idempotency guards:
 *   - an already-paid order returns its existing job (no second print);
 *   - the job is created keyed on orderId, so a race cannot produce two.
 */
export async function confirmPayment({ orderId, attemptId, outcome = 'success', actorId = null }) {
  const repo = getRepository();
  const order = await repo.findById('printOrders', orderId);
  if (!order) throw ApiError.notFound('Order not found', { code: 'ORDER_NOT_FOUND' });

  // Repeat confirmation: hand back what already exists.
  if (order.status === ORDER_STATUS.PAID) {
    const job = order.jobId ? await repo.findById('printJobs', order.jobId) : null;
    return { order, job, alreadyPaid: true, authorized: false };
  }

  const attempt = attemptId
    ? await repo.findById('paymentAttempts', attemptId)
    : await repo.findOne('paymentAttempts', { orderId: order.id }, { includeDeleted: false });

  if (!attempt) {
    throw ApiError.badRequest('No payment attempt found for this order', {
      code: 'PAYMENT_ATTEMPT_NOT_FOUND',
    });
  }
  if (attempt.status === 'succeeded' && order.status === ORDER_STATUS.PAID) {
    return { order, alreadyPaid: true, authorized: false };
  }

  const provider = getPaymentProvider();
  const result = await provider.confirm(
    {
      providerPaymentId: attempt.providerPaymentId,
      amountPaise: attempt.amountPaise,
      simulatedOutcome: outcome,
    },
    { outcome },
  );

  const paymentUpdate = {
    status: result.status,
    providerPaymentId: result.providerPaymentId,
    confirmedAt: result.confirmedAt,
    failureReason: result.failureReason,
    simulated: true,
  };

  if (result.status !== 'succeeded') {
    await repo.updateById('paymentAttempts', attempt.id, paymentUpdate);
    await repo.updateById('printOrders', order.id, { paymentStatus: 'failed' });
    const failed = await repo.findById('printOrders', order.id);
    emitToOrder(order.id, 'order:payment_failed', publicOrder(failed));
    throw ApiError.paymentRequired('The simulated payment failed. Please try again.', {
      code: 'PAYMENT_FAILED',
      details: { reason: result.failureReason },
    });
  }

  await repo.updateById('paymentAttempts', attempt.id, paymentUpdate);

  const paidAt = new Date().toISOString();
  const paid = await repo.updateById('printOrders', order.id, {
    status: ORDER_STATUS.PAID,
    paymentStatus: 'succeeded',
    paidAt,
    simulated: true,
  });

  // Authorize the print. Exactly once, keyed on orderId.
  const machine = await repo.findById('machines', order.machineRef);
  const document = order.documentId ? await repo.findById('documents', order.documentId) : null;

  const { job, created } = await createJobForOrder({ order: paid, machine, document, paidAt });

  const withJob = await repo.updateById('printOrders', order.id, { jobId: job.id });

  emitToOrder(order.id, 'order:paid', publicOrder(withJob));
  emitToOrder(order.id, 'job:status', publicJob(job));
  emitToShop(order.shopId, 'order:paid', publicOrder(withJob));

  return { order: withJob, job, alreadyPaid: false, authorized: created };
}

/** Customer-facing projection. Never includes internal agent data. */
export function publicOrder(order) {
  if (!order) return null;
  return {
    id: order.id,
    orderCode: order.orderCode,
    shopId: order.shopId,
    machineId: order.machineId,
    status: order.status,
    paymentStatus: order.paymentStatus,
    document: order.documentId
      ? { id: order.documentId, name: order.documentName, pageCount: order.pageCount }
      : null,
    print: {
      selectedPages: order.selectedPages,
      copies: order.copies,
      color: order.color,
      sides: order.sides,
      paperSize: order.paperSize,
    },
    quote: order.quote,
    totals: order.totals,
    jobId: order.jobId ?? null,
    paidAt: order.paidAt ?? null,
    createdAt: order.createdAt,
    // Surfaced everywhere so no screen can imply a real payment happened.
    simulated: order.simulated === true,
  };
}

/** Order plus its job and timeline, for the tracking screen. */
export async function getOrderDetail(orderId) {
  const repo = getRepository();
  const order = await repo.findById('printOrders', orderId);
  if (!order) throw ApiError.notFound('Order not found', { code: 'ORDER_NOT_FOUND' });

  const job = order.jobId ? await repo.findById('printJobs', order.jobId) : null;
  const events = job
    ? await repo.findAll('printJobEvents', { jobId: job.id }, { sort: { at: 1 } })
    : [];

  return {
    order: publicOrder(order),
    job: publicJob(job),
    timeline: events.map((event) => ({
      status: event.status,
      note: event.note,
      at: event.at,
      actor: event.actor,
    })),
  };
}

export async function cancelOrder({ orderId, actorId = null, reason = 'Cancelled by customer' }) {
  const repo = getRepository();
  const order = await repo.findById('printOrders', orderId);
  if (!order) throw ApiError.notFound('Order not found', { code: 'ORDER_NOT_FOUND' });

  if (order.status === ORDER_STATUS.PAID) {
    // A paid order is a commitment; cancelling requires a refund path that is
    // not implemented, so refuse rather than silently keeping the money.
    throw ApiError.conflict('A paid order cannot be cancelled — request a refund instead', {
      code: 'ORDER_ALREADY_PAID',
    });
  }
  if (order.status === ORDER_STATUS.CANCELLED) return order;

  const cancelled = await repo.updateById('printOrders', order.id, {
    status: ORDER_STATUS.CANCELLED,
    cancelledAt: new Date().toISOString(),
    cancellationReason: reason,
  });
  emitToShop(order.shopId, 'order:cancelled', publicOrder(cancelled));
  return cancelled;
}

export { publicDocument };
