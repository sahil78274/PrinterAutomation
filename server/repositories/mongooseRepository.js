import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';
import { COLLECTIONS, DuplicateKeyError, RepositoryError, normalisePagination } from './index.js';

/**
 * Mongoose-backed repository — the production adapter.
 *
 * The same contract as `memoryRepository`, mapped onto real collections.
 *
 * ## Why loose schemas
 *
 * Phase 2 shipped hand-tuned Mongoose models (Shop, Machine, User, PrintOrder)
 * whose field-level invariants are already covered by `test/models.test.js`.
 * Rather than duplicate that validation in a second schema, this adapter
 * registers *permissive* models that store whatever the service layer hands
 * it, plus the indexes that actually matter for correctness (uniqueness) and
 * performance. Validation stays in one place: the service layer, which is the
 * layer the tests exercise.
 *
 * The trade-off is real and worth stating: Mongo will not reject a malformed
 * document that bypasses the services. Nothing in this application writes to
 * the database outside a service, so the invariant holds — but it is an
 * invariant maintained by discipline rather than by the database.
 *
 * ## Identifier strategy
 *
 * Documents keep their `id` as a plain string alongside Mongo's `_id`, so the
 * application never deals with ObjectId coercion and the same code works
 * against both adapters. `id` is unique-indexed.
 */

const schemaOptions = {
  timestamps: true,
  strict: false,
  versionKey: false,
  minimize: false,
};

const models = new Map();

/** Fields that must be unique, mirroring the memory adapter's constraints. */
const UNIQUE_FIELDS = {
  users: ['email'],
  shops: ['shopCode'],
  machines: ['machineId', 'qrToken'],
  printAgents: ['agentKey'],
  documents: ['storageKey'],
  printOrders: ['orderCode', 'idempotencyKey'],
  printJobs: ['jobCode'],
  subscriptionInvoices: ['invoiceCode'],
  paymentAttempts: ['idempotencyKey'],
  refreshTokens: ['tokenHash'],
};

/** Secondary indexes the reporting queries rely on. */
const SECONDARY_INDEXES = [
  ['machines', { shopId: 1, status: 1 }],
  ['printOrders', { shopId: 1, createdAt: -1 }],
  ['printOrders', { machineId: 1, createdAt: -1 }],
  ['printJobs', { shopId: 1, status: 1 }],
  ['printJobs', { agentId: 1, status: 1 }],
  ['printJobEvents', { jobId: 1, at: -1 }],
  ['auditLogs', { shopId: 1, createdAt: -1 }],
  ['notifications', { userId: 1, read: 1 }],
  ['documents', { shopId: 1, createdAt: -1 }],
  ['refreshTokens', { userId: 1, revokedAt: 1 }],
];

function getModel(name) {
  if (models.has(name)) return models.get(name);

  const schema = new mongoose.Schema({}, schemaOptions);

  schema.index({ id: 1 }, { unique: true });
  for (const field of UNIQUE_FIELDS[name] ?? []) {
    schema.index({ [field]: 1 }, { unique: true, sparse: true });
  }

  const model = mongoose.models[`Repo_${name}`] ?? mongoose.model(`Repo_${name}`, schema, name);
  models.set(name, model);
  return model;
}

/** Strip Mongo internals so callers get the same shape as the memory adapter. */
function toPlain(doc) {
  if (!doc) return null;
  const raw = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  const { _id, __v, createdAt, updatedAt, ...rest } = raw;
  return {
    ...rest,
    id: rest.id ?? String(_id),
    createdAt: createdAt instanceof Date ? createdAt.toISOString() : (createdAt ?? null),
    updatedAt: updatedAt instanceof Date ? updatedAt.toISOString() : (updatedAt ?? null),
  };
}

function translateError(error, context) {
  if (error?.code === 11000) {
    const field = Object.keys(error.keyPattern ?? error.keyValue ?? {})[0] ?? 'unknown';
    return new DuplicateKeyError(field, error.keyValue?.[field]);
  }
  return new RepositoryError(`${context}: ${error.message}`, {
    code: 'DATABASE_ERROR',
    cause: error,
  });
}

export function createMongooseRepository() {
  // Declared up front so a bad index fails at boot rather than at query time.
  for (const name of COLLECTIONS) getModel(name);
  for (const [name, index] of SECONDARY_INDEXES) {
    getModel(name).schema.index(index);
  }

  return {
    async insert(name, doc) {
      try {
        // CRITICAL FIX: Always generate a new ID for new documents.
        // The previous code had a bug where if doc.id existed (e.g., from a 
        // query result object being accidentally passed to insert), it would
        // try to reuse that ID, causing MongoDB duplicate key errors.
        //
        // We extract all properties except 'id' from doc, then always generate
        // a fresh UUID. This ensures each new document gets a unique ID.
        const { id: existingId, ...docWithoutId } = doc;
        
        const created = await getModel(name).create({
          ...docWithoutId,
          id: randomUUID(),
          deletedAt: doc.deletedAt ?? null,
        });
        return toPlain(created);
      } catch (error) {
        throw translateError(error, `insert ${name}`);
      }
    },

    async findById(name, id, { includeDeleted = false } = {}) {
      const filter = includeDeleted ? { id } : { id, deletedAt: null };
      return toPlain(await getModel(name).findOne(filter).lean());
    },

    async findOne(name, filter = {}, { includeDeleted = false } = {}) {
      const query = includeDeleted ? filter : { ...filter, deletedAt: null };
      return toPlain(await getModel(name).findOne(query).lean());
    },

    async find(name, filter = {}, opts = {}) {
      const { limit, skip } = normalisePagination(opts);
      const query = opts.includeDeleted ? filter : { ...filter, deletedAt: null };
      const cursor = getModel(name)
        .find(query)
        .sort(opts.sort ?? { createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();
      return (await cursor).map(toPlain);
    },

    async findAll(name, filter = {}, opts = {}) {
      const query = opts.includeDeleted ? filter : { ...filter, deletedAt: null };
      return (
        await getModel(name)
          .find(query)
          .sort(opts.sort ?? {})
          .lean()
      ).map(toPlain);
    },

    async count(name, filter = {}, { includeDeleted = false } = {}) {
      const query = includeDeleted ? filter : { ...filter, deletedAt: null };
      return getModel(name).countDocuments(query);
    },

    async updateById(name, id, patch) {
      try {
        const updated = await getModel(name).findOneAndUpdate(
          { id },
          { $set: { ...patch, updatedAt: new Date() } },
          { new: true, lean: true },
        );
        return toPlain(updated);
      } catch (error) {
        throw translateError(error, `update ${name}`);
      }
    },

    async updateOne(name, filter, patch) {
      try {
        const updated = await getModel(name).findOneAndUpdate(
          { ...filter, deletedAt: null },
          { $set: { ...patch, updatedAt: new Date() } },
          { new: true, lean: true },
        );
        return toPlain(updated);
      } catch (error) {
        throw translateError(error, `update ${name}`);
      }
    },

    async increment(name, id, deltas = {}) {
      const $inc = { ...deltas };
      const updated = await getModel(name).findOneAndUpdate(
        { id },
        { $inc, $set: { updatedAt: new Date() } },
        { new: true, lean: true },
      );
      return toPlain(updated);
    },

    async softDelete(name, id) {
      return this.updateById(name, id, { deletedAt: new Date().toISOString() });
    },

    async deleteMany(name, filter = {}) {
      const result = await getModel(name).deleteMany(filter);
      return result.deletedCount ?? 0;
    },

    /** Drops every document. Guarded by the caller: never used in production paths. */
    async reset() {
      for (const name of COLLECTIONS) {
        await getModel(name).deleteMany({});
      }
    },
  };
}

export default createMongooseRepository;
