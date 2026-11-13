import { PLAN_IDS } from '../services/subscriptionService.js';

export function validateChangePlan(body = {}) {
  const errors = {};
  const planId = String(body.planId ?? '')
    .trim()
    .toLowerCase();

  if (!planId) errors.planId = 'Choose a plan';
  else if (!PLAN_IDS.includes(planId)) {
    errors.planId = `Plan must be one of: ${PLAN_IDS.join(', ')}`;
  }

  return { value: { planId }, errors };
}

export function validateCancelSubscription(body = {}) {
  const errors = {};
  const reason = body?.reason === undefined ? null : String(body.reason).trim().slice(0, 200);
  return { value: { reason }, errors };
}
