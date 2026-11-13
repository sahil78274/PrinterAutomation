import ApiError from '../utils/ApiError.js';
import { getRepository } from '../repositories/active.js';
import config from '../config/index.js';

/**
 * Subscriptions and billing.
 *
 * The platform earns from two places: a per-order fee (already applied by the
 * pricing engine) and a monthly plan. This module owns the plan.
 *
 * Like payments, billing is **simulated** in this build: invoices are real
 * records with real arithmetic, but no gateway is contacted and every record is
 * marked `simulated: true`. `assertBillingAvailable` refuses to run in
 * production, so a launch cannot accidentally depend on it.
 */

export const PLAN_IDS = ['trial', 'starter', 'growth', 'scale'];

/**
 * Plans, in integer paise per month.
 *
 * Kept in code rather than the database so a pricing change is a reviewed
 * commit, not a row edit. `monthlyPaise: 0` on trial is deliberate: the trial
 * is free, not merely discounted.
 */
export const PLANS = Object.freeze({
  trial: {
    id: 'trial',
    name: 'Trial',
    monthlyPaise: 0,
    maxMachines: 2,
    maxStaff: 1,
    platformFeeBps: 600,
    trialDays: 14,
    features: ['QR ordering', 'Simulated payments', 'Basic dashboard'],
  },
  starter: {
    id: 'starter',
    name: 'Starter',
    monthlyPaise: 49_900,
    maxMachines: 4,
    maxStaff: 3,
    platformFeeBps: 500,
    trialDays: 0,
    features: ['Everything in Trial', '4 machines', '3 staff accounts', 'CSV exports'],
  },
  growth: {
    id: 'growth',
    name: 'Growth',
    monthlyPaise: 129_900,
    maxMachines: 12,
    maxStaff: 10,
    platformFeeBps: 400,
    trialDays: 0,
    features: ['Everything in Starter', '12 machines', '10 staff', 'Priority support'],
  },
  scale: {
    id: 'scale',
    name: 'Scale',
    monthlyPaise: 299_900,
    maxMachines: 50,
    maxStaff: 50,
    platformFeeBps: 300,
    trialDays: 0,
    features: ['Everything in Growth', '50 machines', 'Custom fee rate', 'Dedicated support'],
  },
});

export function assertBillingAvailable() {
  if (config.isProduction) {
    throw ApiError.internal(
      'Subscription billing is simulated in this build and must not be used in production',
      { code: 'BILLING_NOT_AVAILABLE', expose: false },
    );
  }
  return true;
}

export function publicPlan(plan) {
  return {
    id: plan.id,
    name: plan.name,
    monthlyPaise: plan.monthlyPaise,
    monthly: `₹${(plan.monthlyPaise / 100).toFixed(2)}`,
    maxMachines: plan.maxMachines,
    maxStaff: plan.maxStaff,
    platformFeeBps: plan.platformFeeBps,
    platformFeePercent: plan.platformFeeBps / 100,
    trialDays: plan.trialDays,
    features: plan.features,
  };
}

export function listPlans() {
  return PLAN_IDS.map((id) => publicPlan(PLANS[id]));
}

/** The subscription currently in force for a shop, or a helpful 404. */
export async function getSubscription(shopId) {
  const repo = getRepository();
  const subscription = await repo.findOne('subscriptions', { shopId });
  if (!subscription) {
    throw ApiError.notFound('This shop has no subscription', { code: 'SUBSCRIPTION_NOT_FOUND' });
  }
  return subscription;
}

/**
 * Start a subscription (or change plan).
 *
 * Dates are computed once, from a single `now`, so a period cannot start before
 * it ends. A plan change takes effect immediately and records the change rather
 * than silently overwriting history.
 */
export async function setPlan(shopId, planId, { actorId = null, now = new Date() } = {}) {
  assertBillingAvailable();

  if (!PLAN_IDS.includes(planId)) {
    throw ApiError.unprocessable('Unknown plan', {
      code: 'VALIDATION_ERROR',
      details: { planId: `Must be one of: ${PLAN_IDS.join(', ')}` },
    });
  }

  const repo = getRepository();
  const shop = await repo.findById('shops', shopId);
  if (!shop) throw ApiError.notFound('Shop not found', { code: 'SHOP_NOT_FOUND' });

  const plan = PLANS[planId];
  const existing = await repo.findOne('subscriptions', { shopId });

  const periodStart = new Date(now);
  const periodEnd = new Date(now);
  if (planId === 'trial' && plan.trialDays > 0) {
    periodEnd.setDate(periodEnd.getDate() + plan.trialDays);
  } else {
    periodEnd.setMonth(periodEnd.getMonth() + 1);
  }

  const record = {
    shopId,
    planId,
    status: planId === 'trial' ? 'trialing' : 'active',
    monthlyPaise: plan.monthlyPaise,
    platformFeeBps: plan.platformFeeBps,
    maxMachines: plan.maxMachines,
    maxStaff: plan.maxStaff,
    currentPeriodStart: periodStart.toISOString(),
    currentPeriodEnd: periodEnd.toISOString(),
    cancelAtPeriodEnd: false,
    simulated: true,
    updatedBy: actorId,
  };

  const subscription = existing
    ? await repo.updateById('subscriptions', existing.id, {
        ...record,
        planHistory: [
          ...(existing.planHistory ?? []),
          { planId: existing.planId, changedAt: now.toISOString(), changedBy: actorId },
        ],
      })
    : await repo.insert('subscriptions', {
        ...record,
        planHistory: [{ planId, changedAt: now.toISOString(), changedBy: actorId }],
        createdAt: now.toISOString(),
      });

  // Keep the shop's own plan fields in step: they are what other services read.
  await repo.updateById('shops', shopId, {
    planId,
    planStatus: record.status,
    maxMachines: plan.maxMachines,
    platformFeeBps: plan.platformFeeBps,
  });

  return subscription;
}

/**
 * Record an invoice for the current period.
 *
 * Idempotent per (shopId, periodStart): asking twice does not bill twice, which
 * matters because a retried request is indistinguishable from a new one.
 */
export async function issueInvoice(shopId, { actorId = null, now = new Date() } = {}) {
  assertBillingAvailable();

  const repo = getRepository();
  const subscription = await getSubscription(shopId);

  const periodStart = subscription.currentPeriodStart;
  const existing = await repo.findOne('subscriptionInvoices', { shopId, periodStart });
  if (existing) return { invoice: existing, created: false };

  const amountPaise = subscription.monthlyPaise ?? 0;
  const count = await repo.count('subscriptionInvoices', { shopId });

  const invoice = await repo.insert('subscriptionInvoices', {
    shopId,
    subscriptionId: subscription.id,
    invoiceNumber: `INV-${new Date(periodStart).toISOString().slice(0, 7).replace('-', '')}-${String(count + 1).padStart(4, '0')}`,
    periodStart,
    periodEnd: subscription.currentPeriodEnd,
    amountPaise,
    currency: 'INR',
    // A free trial still gets an invoice, for the record: a zero-value invoice
    // is proof the period was billed, not a gap in the history.
    status: amountPaise === 0 ? 'paid' : 'open',
    paidAt: amountPaise === 0 ? now.toISOString() : null,
    simulated: true,
    issuedBy: actorId,
    createdAt: now.toISOString(),
  });

  return { invoice, created: true };
}

export async function listInvoices(shopId, { limit = 24 } = {}) {
  const repo = getRepository();
  const invoices = await repo.findAll(
    'subscriptionInvoices',
    { shopId },
    { sort: { createdAt: -1 }, limit },
  );
  return invoices;
}

/**
 * Cancel at period end.
 *
 * Not immediate: the shop has paid for the period and keeps trading until it
 * ends. Immediate suspension is a separate, deliberate admin action.
 */
export async function cancelSubscription(
  shopId,
  { actorId = null, reason = null, now = new Date() } = {},
) {
  assertBillingAvailable();

  const repo = getRepository();
  const subscription = await getSubscription(shopId);
  if (subscription.cancelAtPeriodEnd) {
    return { subscription, changed: false };
  }

  const updated = await repo.updateById('subscriptions', subscription.id, {
    cancelAtPeriodEnd: true,
    cancelledAt: now.toISOString(),
    cancelledBy: actorId,
    cancellationReason: reason,
  });

  return { subscription: updated, changed: true };
}

export function publicSubscription(subscription) {
  if (!subscription) return null;
  const plan = PLANS[subscription.planId] ?? null;
  const ended = new Date(subscription.currentPeriodEnd).getTime() < Date.now();

  return {
    planId: subscription.planId,
    planName: plan?.name ?? subscription.planId,
    status: subscription.status,
    monthlyPaise: subscription.monthlyPaise,
    monthly: `₹${((subscription.monthlyPaise ?? 0) / 100).toFixed(2)}`,
    platformFeePercent: (subscription.platformFeeBps ?? 0) / 100,
    maxMachines: subscription.maxMachines,
    maxStaff: subscription.maxStaff,
    currentPeriodStart: subscription.currentPeriodStart,
    currentPeriodEnd: subscription.currentPeriodEnd,
    // Computed, never stored: a stored flag goes stale the moment a clock moves.
    expired: ended,
    cancelAtPeriodEnd: Boolean(subscription.cancelAtPeriodEnd),
    simulated: true,
  };
}

export default {
  PLANS,
  PLAN_IDS,
  assertBillingAvailable,
  cancelSubscription,
  getSubscription,
  issueInvoice,
  listInvoices,
  listPlans,
  publicPlan,
  publicSubscription,
  setPlan,
};
