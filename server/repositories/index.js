/**
 * Repository layer.
 *
 * The application talks to storage through this contract, never to Mongoose
 * directly. Two adapters implement it:
 *
 *   mongooseRepository — production. Real MongoDB, real indexes, real
 *                        transactions.
 *   memoryRepository   — tests and local development without a database.
 *
 * Why bother: business logic that can only run against a live MongoDB is
 * business logic nobody can test in CI. The tests here execute the *same*
 * service code paths against the memory adapter, so pricing, tenancy, the job
 * state machine and the payment flow are genuinely exercised rather than
 * assumed. The Mongoose adapter is then a thin mapping layer that is much
 * easier to review — though it must still be run against a real cluster, which
 * this environment cannot do.
 *
 * The contract is deliberately narrow: plain objects in, plain objects out, no
 * Mongoose documents or query builders leak upward. Every method is scoped by
 * `shopId` where the resource is tenant-owned, because forgetting that filter
 * is exactly how cross-tenant leaks happen.
 */

/** Collections the platform persists. */
export const COLLECTIONS = [
  'users',
  'shops',
  'machines',
  'printAgents',
  'documents',
  'printOrders',
  'printJobs',
  'printJobEvents',
  'pricingConfigurations',
  'subscriptions',
  'subscriptionInvoices',
  'paymentAttempts',
  'webhookEvents',
  'refreshTokens',
  'auditLogs',
  'notifications',
];

/** Every repository method that returns a list accepts these. */
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export function normalisePagination({ page = 1, limit = DEFAULT_PAGE_SIZE } = {}) {
  const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
  const safeLimit = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number.parseInt(limit, 10) || DEFAULT_PAGE_SIZE),
  );
  return { page: safePage, limit: safeLimit, skip: (safePage - 1) * safeLimit };
}

export function paginatedMeta({ page, limit, total }) {
  const pages = Math.max(1, Math.ceil(total / limit));
  return { page, limit, total, pages, hasNext: page < pages, hasPrev: page > 1 };
}

/**
 * The contract. Documented here so both adapters can be checked against one
 * description instead of drifting apart silently.
 *
 * @typedef {object} Repository
 * @property {(name: string, doc: object) => Promise<object>} insert
 * @property {(name: string, id: string) => Promise<object|null>} findById
 * @property {(name: string, filter: object) => Promise<object|null>} findOne
 * @property {(name: string, filter: object, opts?: object) => Promise<object[]>} find
 * @property {(name: string, filter: object) => Promise<number>} count
 * @property {(name: string, id: string, patch: object) => Promise<object|null>} updateById
 * @property {(name: string, filter: object, patch: object) => Promise<object|null>} updateOne
 * @property {(name: string, id: string, patch: object) => Promise<object|null>} softDelete
 * @property {() => Promise<void>} reset
 */

/** Errors the repository may raise, mapped to HTTP by the error middleware. */
export class RepositoryError extends Error {
  constructor(message, { code = 'REPOSITORY_ERROR', cause } = {}) {
    super(message);
    this.name = 'RepositoryError';
    this.code = code;
    if (cause) this.cause = cause;
  }
}

export class DuplicateKeyError extends RepositoryError {
  constructor(field, value) {
    super(`Duplicate value for ${field}`, { code: 'DUPLICATE_KEY' });
    this.field = field;
    this.value = value;
  }
}
