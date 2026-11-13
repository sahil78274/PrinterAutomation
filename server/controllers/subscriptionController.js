import asyncHandler from '../utils/asyncHandler.js';
import { sendCreated, sendSuccess } from '../utils/apiResponse.js';
import ApiError from '../utils/ApiError.js';
import {
  cancelSubscription,
  getSubscription,
  issueInvoice,
  listInvoices,
  listPlans,
  publicSubscription,
  setPlan,
} from '../services/subscriptionService.js';
import { getShopByIdOrCode } from '../services/shopService.js';
import { audit } from '../services/auditService.js';

/**
 * Subscription HTTP layer.
 *
 * An owner sees and changes only their own shop's plan. Reading the plan history
 * of another tenant is impossible: the shop id comes from the token.
 */

function ownShopId(req) {
  if (!req.auth?.shopId) {
    throw ApiError.forbidden('This account is not attached to a shop', { code: 'NO_SHOP' });
  }
  return req.auth.shopId;
}

/** GET /api/subscriptions/plans — public price list. */
export const listPlansHandler = asyncHandler(async (req, res) => {
  return sendSuccess(res, listPlans());
});

/** GET /api/subscriptions/current */
export const getCurrentHandler = asyncHandler(async (req, res) => {
  const subscription = await getSubscription(ownShopId(req));
  const invoices = await listInvoices(subscription.shopId, { limit: 12 });
  return sendSuccess(res, {
    ...publicSubscription(subscription),
    invoices: invoices.map((invoice) => ({
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      periodStart: invoice.periodStart,
      periodEnd: invoice.periodEnd,
      amountPaise: invoice.amountPaise,
      amount: `₹${(invoice.amountPaise / 100).toFixed(2)}`,
      status: invoice.status,
      simulated: true,
    })),
  });
});

/** POST /api/subscriptions/plan — change plan. */
export const changePlanHandler = asyncHandler(async (req, res) => {
  const shopId = ownShopId(req);
  const subscription = await setPlan(shopId, req.body.planId, { actorId: req.auth.userId });

  await audit(req, {
    action: 'subscription.plan_changed',
    entity: 'subscription',
    entityId: subscription.id,
    shopId,
    metadata: { planId: subscription.planId },
  });

  return sendSuccess(res, publicSubscription(subscription));
});

/** POST /api/subscriptions/invoices — issue (or re-fetch) this period's invoice. */
export const issueInvoiceHandler = asyncHandler(async (req, res) => {
  const shopId = ownShopId(req);
  const { invoice, created } = await issueInvoice(shopId, { actorId: req.auth.userId });

  await audit(req, {
    action: created ? 'subscription.invoice_issued' : 'subscription.invoice_reused',
    entity: 'subscriptionInvoice',
    entityId: invoice.id,
    shopId,
    metadata: { invoiceNumber: invoice.invoiceNumber, amountPaise: invoice.amountPaise },
  });

  const payload = {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    periodStart: invoice.periodStart,
    periodEnd: invoice.periodEnd,
    amountPaise: invoice.amountPaise,
    amount: `₹${(invoice.amountPaise / 100).toFixed(2)}`,
    status: invoice.status,
    simulated: true,
  };

  return created ? sendCreated(res, payload) : sendSuccess(res, payload);
});

/** POST /api/subscriptions/cancel */
export const cancelHandler = asyncHandler(async (req, res) => {
  const shopId = ownShopId(req);
  const { subscription, changed } = await cancelSubscription(shopId, {
    actorId: req.auth.userId,
    reason: req.body?.reason ?? null,
  });

  await audit(req, {
    action: changed ? 'subscription.cancelled' : 'subscription.cancel_noop',
    entity: 'subscription',
    entityId: subscription.id,
    shopId,
  });

  return sendSuccess(res, publicSubscription(subscription), { meta: { changed } });
});

/** GET /api/subscriptions/shops/:identifier — admin view of any shop's plan. */
export const getShopSubscriptionHandler = asyncHandler(async (req, res) => {
  const shop = await getShopByIdOrCode(req.params.identifier);
  const subscription = await getSubscription(shop.id);
  return sendSuccess(res, { shopId: shop.id, ...publicSubscription(subscription) });
});
