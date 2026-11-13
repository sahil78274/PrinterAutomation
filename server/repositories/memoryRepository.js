import { randomUUID } from 'node:crypto';
import { COLLECTIONS, DuplicateKeyError, normalisePagination, paginatedMeta } from './index.js';

/**
 * In-memory repository.
 *
 * Implements the same contract as the Mongoose adapter using plain objects and
 * arrays. Used by the test suite and by local development when no MongoDB is
 * available.
 *
 * It is deliberately *strict* rather than convenient:
 *  - unique indexes are enforced, because a duplicate machine code or shop code
 *    is a real product bug and the memory adapter must catch it the same way
 *    the database would;
 *  - filters use the same shape the Mongoose adapter receives, so a query that
 *    passes here is structurally valid there;
 *  - results are deep-copied, so a caller mutating what it got back cannot
 *    silently corrupt stored state (a real Mongo connection would not).
 */

/** Field sets that must be unique, per collection. Mirrors the Mongo indexes. */
const UNIQUE_KEYS = {
  users: ['email'],
  shops: ['shopCode'],
  machines: ['machineId', 'qrToken'],
  printAgents: ['agentKey'],
  documents: ['storageKey'],
  printOrders: ['orderCode', 'idempotencyKey'],
  printJobs: ['jobCode'],
  subscriptions: [],
  subscriptionInvoices: ['invoiceCode'],
  paymentAttempts: ['idempotencyKey'],
  refreshTokens: ['tokenHash'],
};

const clone = (value) => (value === null || value === undefined ? value : structuredClone(value));

/** Turn 'a.b.c' into a predicate on nested keys. */
function readPath(doc, path) {
  return path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), doc);
}

/**
 * Match a document against a Mongo-ish filter.
 *
 * Supports equality, `$in`, `$ne`, `$nin`, `$exists`, `$gt/$gte/$lt/$lte`,
 * `$regex`, and logical `$and`/`$or`. That is everything the services use; a
 * filter needing more indicates the query belongs in a model method instead.
 */
function matches(doc, filter = {}) {
  return Object.entries(filter).every(([key, condition]) => {
    if (key === '$and') return condition.every((sub) => matches(doc, sub));
    if (key === '$or') return condition.some((sub) => matches(doc, sub));

    const value = readPath(doc, key);

    if (condition === null) return value === null || value === undefined;

    if (typeof condition === 'object' && !Array.isArray(condition) && condition !== null) {
      const operators = Object.keys(condition);
      const isOperatorObject = operators.some((op) => op.startsWith('$'));

      if (!isOperatorObject) {
        // Nested equality on a subdocument.
        return (
          matches(Object.assign(Object.create(null), { value }), { value: condition }) ||
          JSON.stringify(value) === JSON.stringify(condition)
        );
      }

      return operators.every((op) => {
        const expected = condition[op];
        switch (op) {
          case '$in':
            return expected.some((item) => String(item) === String(value));
          case '$nin':
            return !expected.some((item) => String(item) === String(value));
          case '$ne':
            return String(value) !== String(expected);
          case '$exists':
            return expected ? value !== undefined : value === undefined;
          case '$gt':
            return value > expected;
          case '$gte':
            return value >= expected;
          case '$lt':
            return value < expected;
          case '$lte':
            return value <= expected;
          case '$regex':
            return new RegExp(expected, condition.$options ?? '').test(String(value ?? ''));
          default:
            throw new Error(`Unsupported filter operator: ${op}`);
        }
      });
    }

    if (Array.isArray(value)) return value.includes(condition);
    return value === condition;
  });
}

export function createMemoryRepository({ collections = COLLECTIONS } = {}) {
  /** collection name -> array of plain documents */
  const store = new Map();
  for (const name of collections) store.set(name, []);

  const all = (name) => {
    if (!store.has(name)) throw new Error(`Unknown collection: ${name}`);
    return store.get(name);
  };

  const assertUnique = (name, doc, existingId = null) => {
    for (const field of UNIQUE_KEYS[name] ?? []) {
      const value = readPath(doc, field);
      if (value === undefined || value === null) continue;
      const clash = all(name).find(
        (row) =>
          String(readPath(row, field)) === String(value) && String(row.id) !== String(existingId),
      );
      if (clash) throw new DuplicateKeyError(field, value);
    }
  };

  return {
    /** Insert one document. Assigns `id` and timestamps. */
    async insert(name, doc) {
      const collection = all(name);
      const now = new Date().toISOString();
      const record = {
        ...clone(doc),
        id: doc.id ?? randomUUID(),
        createdAt: doc.createdAt ?? now,
        updatedAt: now,
        deletedAt: null,
      };
      assertUnique(name, record);
      collection.push(record);
      return clone(record);
    },

    /** Find by id. Soft-deleted records are excluded unless `includeDeleted`. */
    async findById(name, id, { includeDeleted = false } = {}) {
      const found = all(name).find((row) => row.id === id);
      if (!found) return null;
      if (found.deletedAt && !includeDeleted) return null;
      return clone(found);
    },

    async findOne(name, filter = {}, { includeDeleted = false } = {}) {
      const found = all(name).find(
        (row) => matches(row, filter) && (includeDeleted || !row.deletedAt),
      );
      return found ? clone(found) : null;
    },

    /**
     * Find many.
     * @param {object} [opts]
     * @param {number} [opts.page] @param {number} [opts.limit]
     * @param {object} [opts.sort]  e.g. { createdAt: -1 }
     * @param {boolean} [opts.includeDeleted]
     */
    async find(name, filter = {}, opts = {}) {
      const { page, limit, skip } = normalisePagination(opts);
      const { sort, includeDeleted = false } = opts;

      let rows = all(name).filter(
        (row) => matches(row, filter) && (includeDeleted || !row.deletedAt),
      );

      if (sort) {
        const [field, direction] = Object.entries(sort)[0] ?? [];
        if (field) {
          rows = [...rows].sort((a, b) => {
            const av = readPath(a, field);
            const bv = readPath(b, field);
            if (av === bv) return 0;
            const result = av > bv ? 1 : -1;
            return direction === -1 ? -result : result;
          });
        }
      }

      return rows.slice(skip, skip + limit).map(clone);
    },

    async findAll(name, filter = {}, opts = {}) {
      return await this.find(name, filter, { ...opts, page: 1, limit: Number.MAX_SAFE_INTEGER });
    },

    async count(name, filter = {}, { includeDeleted = false } = {}) {
      return all(name).filter((row) => matches(row, filter) && (includeDeleted || !row.deletedAt))
        .length;
    },

    async updateById(name, id, patch) {
      const collection = all(name);
      const index = collection.findIndex((row) => row.id === id);
      if (index === -1) return null;

      const updated = {
        ...collection[index],
        ...clone(patch),
        id: collection[index].id,
        updatedAt: new Date().toISOString(),
      };
      assertUnique(name, updated, id);
      collection[index] = updated;
      return clone(updated);
    },

    async updateOne(name, filter, patch) {
      const found = all(name).find((row) => matches(row, filter) && !row.deletedAt);
      if (!found) return null;
      return this.updateById(name, found.id, patch);
    },

    /**
     * Atomic increment used by counters (job counts, usage totals).
     * Returns the updated document or null.
     */
    async increment(name, id, deltas = {}) {
      const collection = all(name);
      const index = collection.findIndex((row) => row.id === id);
      if (index === -1) return null;
      const updated = { ...collection[index] };
      for (const [field, delta] of Object.entries(deltas)) {
        updated[field] = (readPath(updated, field) ?? 0) + delta;
      }
      updated.updatedAt = new Date().toISOString();
      collection[index] = updated;
      return clone(updated);
    },

    async softDelete(name, id) {
      return this.updateById(name, id, { deletedAt: new Date().toISOString() });
    },

    async deleteMany(name, filter = {}) {
      if (!store.has(name)) throw new Error(`Unknown collection: ${name}`);
      const remaining = all(name).filter((row) => !matches(row, filter));
      const removed = all(name).length - remaining.length;
      store.set(name, remaining);
      return removed;
    },

    /** Drop everything. Used between tests. */
    async reset() {
      for (const name of store.keys()) store.set(name, []);
    },

    /** Test helpers — not part of the production contract. */
    _debug(name) {
      return all(name).map(clone);
    },
    _meta({ page, limit, total }) {
      return paginatedMeta({ page, limit, total });
    },
    _matches: matches,
  };
}

export default createMemoryRepository;
