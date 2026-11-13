import ApiError from '../../utils/ApiError.js';
import config from '../../config/index.js';

/**
 * Payment provider abstraction.
 *
 * The interface a real gateway (UPI dynamic QR, Razorpay, Stripe) must implement:
 *
 *   createIntent({ order, amountPaise, idempotencyKey }) -> { providerPaymentId, ... }
 *   confirm(intentId, { outcome })                      -> { status, ... }
 *   verifyWebhook(rawBody, signature)                   -> { valid, event }
 *
 * Only the development simulator is implemented. The point of the abstraction is
 * that swapping in a real provider touches this directory and nothing else —
 * order, job and pricing code never learn which gateway is in use.
 *
 * ## The hard rule
 *
 * `development` is refused at boot in production (see config validation). A
 * simulated success in production would mean free printing.
 */

/** @typedef {'development'} ProviderName */

const SUPPORTED = new Set(['development']);

export function assertProviderAvailable() {
  const name = config.payments.provider;
  if (!SUPPORTED.has(name)) {
    throw ApiError.internal(
      `Payment provider "${name}" is not implemented. Supported: ${[...SUPPORTED].join(', ')}`,
      { code: 'PAYMENT_PROVIDER_UNAVAILABLE' },
    );
  }
  if (config.isProduction && name === 'development') {
    throw ApiError.internal('The development payment provider cannot run in production', {
      code: 'PAYMENT_PROVIDER_FORBIDDEN',
    });
  }
  return name;
}

/**
 * Development provider.
 *
 * Deliberately explicit about being fake. Every record it writes carries
 * `simulated: true`, and the order/job it authorizes carries the same flag up to
 * the customer's screen, so no part of the system can imply a real payment
 * happened.
 */
export const developmentProvider = {
  name: 'development',

  /**
   * Create a "payment intent".
   *
   * No network call, no money. Returns a record the client can "pay" against.
   * The outcome is decided by the caller-supplied `outcome`, which exists so the
   * failure path can be tested without a fault injector.
   */
  async createIntent({ order, amountPaise, idempotencyKey = null, outcome = 'success' }) {
    assertProviderAvailable();

    if (!Number.isInteger(amountPaise) || amountPaise < 1) {
      throw ApiError.badRequest('A payment intent needs a positive integer amount', {
        code: 'INVALID_AMOUNT',
      });
    }
    if (!['success', 'failure'].includes(outcome)) {
      throw ApiError.badRequest("Simulated outcome must be 'success' or 'failure'", {
        code: 'INVALID_OUTCOME',
      });
    }

    return {
      provider: 'development',
      providerPaymentId: `dev_pay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      orderId: order.id,
      amountPaise,
      currency: 'INR',
      idempotencyKey,
      simulatedOutcome: outcome,
      simulated: true,
      // No real gateway URL. The client "completes" payment by calling the
      // confirm endpoint, exactly as it would after a gateway redirect.
      checkoutUrl: null,
      createdAt: new Date().toISOString(),
    };
  },

  /**
   * Confirm an intent. In development this is where the outcome is applied.
   *
   * A real provider would call the gateway and verify the result server-side;
   * the shape of the return value is the same, which is the point.
   */
  async confirm(intent, { outcome } = {}) {
    assertProviderAvailable();
    const resolved = outcome ?? intent.simulatedOutcome ?? 'success';

    if (!['success', 'failure'].includes(resolved)) {
      throw ApiError.badRequest('Invalid simulated outcome', { code: 'INVALID_OUTCOME' });
    }

    return {
      status: resolved === 'success' ? 'succeeded' : 'failed',
      provider: 'development',
      providerPaymentId: intent.providerPaymentId,
      amountPaise: intent.amountPaise,
      simulated: true,
      failureReason: resolved === 'failure' ? 'Simulated payment failure' : null,
      confirmedAt: new Date().toISOString(),
    };
  },

  /**
   * Webhook verification.
   *
   * The development provider has no webhooks. A real implementation must verify
   * an HMAC signature over the raw request body *before* parsing it, which is
   * why the raw body is a separate parameter here.
   */
  async verifyWebhook() {
    return { valid: false, event: null, reason: 'The development provider does not send webhooks' };
  },
};

/** Resolve the configured provider. */
export function getPaymentProvider() {
  const name = assertProviderAvailable();
  return { development: developmentProvider }[name];
}
