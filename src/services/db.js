import {
  FUNNEL_DATA,
  MACHINES,
  NOTIFICATIONS,
  ORDERS,
  PAYOUTS,
  PLATFORM_REVENUE_SERIES,
  SHOPS,
  SUBSCRIPTION_INVOICES,
} from '../data/seed.js';

/**
 * MOCK DATABASE (frontend only).
 *
 * A single mutable in-memory store shared by every interface, so an order placed
 * in the customer portal instantly shows up in the shop dashboard and admin
 * console. Nothing is persisted beyond the browser session.
 *
 * When the Express/MongoDB backend lands, this module is replaced by fetch calls
 * in `src/services/api.js` — the exported function signatures stay the same.
 */
const clone = (value) => structuredClone(value);

export const db = {
  shops: clone(SHOPS),
  machines: clone(MACHINES),
  orders: clone(ORDERS),
  payouts: clone(PAYOUTS),
  notifications: clone(NOTIFICATIONS),
  revenueSeries: clone(PLATFORM_REVENUE_SERIES),
  funnel: clone(FUNNEL_DATA),
  invoices: clone(SUBSCRIPTION_INVOICES),
  drafts: [],
  agentCommands: [],
};

const listeners = new Set();

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitChange() {
  listeners.forEach((listener) => listener());
}
