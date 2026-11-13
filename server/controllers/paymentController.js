import asyncHandler from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import ApiError from '../utils/ApiError.js';
import { getRepository } from '../repositories/active.js';
import config from '../config/index.js';
import { getPaymentProvider } from '../services/payments/provider.js';

/**
 * Payment inspection.
 *
 * There is deliberately no "create payment" endpoint here: payments are created
 * by the order flow (`POST /api/orders/:id/pay`), which is the only place that
 * knows the amount. This module is read-only plus the webhook receiver.
 */

/** GET /api/payments/provider — what this deployment can actually do. */
export const getProviderHandler = asyncHandler(async (req, res) => {
  const provider = getPaymentProvider();
  return sendSuccess(res, {
    name: provider.name,
    // The single most important field in this response.
    simulated: true,
    currencies: ['INR'],
    platformFeeBps: config.payments.platformFeeBps,
    message:
      'Payments are simulated in this build. No gateway is contacted and no real money moves.',
  });
});

/** GET /api/payments — the shop's own payment attempts. */
export const listPaymentsHandler = asyncHandler(async (req, res) => {
  const repo = getRepository();
  if (!req.auth?.shopId) {
    throw ApiError.forbidden('This account is not attached to a shop', { code: 'NO_SHOP' });
  }

  const filter = { shopId: req.auth.shopId };
  if (req.query.orderId) filter.orderId = String(req.query.orderId);
  if (req.query.status) filter.status = String(req.query.status);

  const payments = await repo.findAll('paymentAttempts', filter, {
    sort: { createdAt: -1 },
    limit: Math.min(100, Number(req.query.limit ?? 50)),
  });

  return sendSuccess(
    res,
    payments.map((payment) => ({
      id: payment.id,
      orderId: payment.orderId,
      amountPaise: payment.amountPaise,
      amount: `₹${((payment.amountPaise ?? 0) / 100).toFixed(2)}`,
      status: payment.status,
      method: payment.method ?? 'simulated',
      simulated: true,
      createdAt: payment.createdAt,
      confirmedAt: payment.confirmedAt ?? null,
      failureReason: payment.failureReason ?? null,
    })),
    { meta: { total: payments.length } },
  );
});

/**
 * POST /api/payments/webhook
 *
 * Signature-verified before anything is read. The development provider rejects
 * any request without a valid HMAC, so this route cannot be used to mark an
 * order paid by hand.
 */
export const webhookHandler = asyncHandler(async (req, res) => {
  const provider = getPaymentProvider();

  const raw = req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
  const signature = req.headers['x-payment-signature'];
  const verified = await provider.verifyWebhook({ raw, signature });

  if (!verified.valid) {
    throw ApiError.unauthorized('Invalid webhook signature', { code: 'INVALID_SIGNATURE' });
  }

  const repo = getRepository();
  const event = await repo.insert('webhookEvents', {
    provider: provider.name,
    eventId: verified.eventId,
    type: verified.type,
    orderId: verified.orderId,
    simulated: true,
    receivedAt: new Date().toISOString(),
    processed: false,
  });

  return sendSuccess(res, { received: true, eventId: event.eventId });
});
