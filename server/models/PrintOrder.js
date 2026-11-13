import mongoose from 'mongoose';

const { Schema, model } = mongoose;

/**
 * A PrintOrder is the central transactional record.
 *
 * Ownership is denormalised on purpose: `shopId` and `machineId` are copied at
 * creation time so reporting never has to re-traverse relations, and moving a
 * machine between shops cannot rewrite historical revenue.
 *
 * IMPORTANT (Phase 2 constraint): there is no payment gateway integration and
 * no printing. The `payment.status` enum stops at `pending` / `failed` /
 * `refunded`; there is deliberately no `success` transition available without a
 * future server-side gateway verification. Nothing in this codebase may mark an
 * order paid on the client's word.
 */

const selectionSchema = new Schema(
  {
    documentName: { type: String, trim: true, maxlength: 255, required: true },
    // Storage key for the uploaded PDF (Phase 3: object storage). Null until upload lands.
    storageKey: { type: String, trim: true, default: null },
    pageCount: { type: Number, min: 1, required: true },
    selectedPages: { type: [Number], default: undefined },
    copies: { type: Number, min: 1, max: 99, default: 1 },
    color: { type: Boolean, default: false },
    sides: { type: String, enum: ['single', 'double'], default: 'single' },
    paperSize: { type: String, enum: ['A4', 'A3', 'Letter', 'Legal'], default: 'A4' },
    finishing: { type: String, enum: ['none', 'staple', 'spiral'], default: 'none' },
    // Amount for this document in paise; computed by the pricing service.
    amountPaise: { type: Number, min: 0, default: 0 },
  },
  { _id: false },
);

const eventSchema = new Schema(
  {
    status: { type: String, required: true },
    at: { type: Date, default: Date.now },
    note: { type: String, trim: true, maxlength: 300, default: null },
    // Who or what caused the transition: 'customer' | 'shop' | 'agent' | 'system'
    actor: {
      type: String,
      enum: ['customer', 'shop', 'staff', 'agent', 'system'],
      default: 'system',
    },
  },
  { _id: false },
);

const paymentSchema = new Schema(
  {
    // No gateway is wired in Phase 2. `method` is a customer preference only.
    method: { type: String, enum: ['upi', 'card', 'netbanking', 'counter'], default: 'upi' },
    status: {
      type: String,
      enum: ['pending', 'failed', 'refunded', 'not_required'],
      default: 'pending',
      index: true,
    },
    provider: { type: String, trim: true, default: null },
    providerRef: { type: String, trim: true, default: null },
    amountPaise: { type: Number, min: 0, default: 0 },
    verifiedAt: { type: Date, default: null },
  },
  { _id: false },
);

const printOrderSchema = new Schema(
  {
    // Customer-facing reference, e.g. SPO-1042.
    orderCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      maxlength: 24,
      index: true,
    },

    shopId: { type: Schema.Types.ObjectId, ref: 'Shop', required: true, index: true },
    machineId: { type: String, required: true, uppercase: true, trim: true, index: true },
    // ObjectId of the machine document, for populated joins.
    machineRef: { type: Schema.Types.ObjectId, ref: 'Machine', default: null },

    customer: {
      name: { type: String, trim: true, maxlength: 120, default: 'Walk-in customer' },
      phone: { type: String, trim: true, maxlength: 20, default: null },
      email: { type: String, trim: true, maxlength: 160, default: null },
    },

    documents: {
      type: [selectionSchema],
      validate: {
        validator: (docs) => Array.isArray(docs) && docs.length > 0 && docs.length <= 5,
        message: 'An order must contain between 1 and 5 documents',
      },
    },

    status: {
      type: String,
      enum: [
        'draft',
        'awaiting_payment',
        'paid',
        'queued',
        'printing',
        'completed',
        'failed',
        'cancelled',
        'refunded',
      ],
      default: 'draft',
      index: true,
    },

    payment: { type: paymentSchema, default: () => ({}) },

    // Money in paise. `totalPaise` is server-computed and never trusted from the client.
    totals: {
      subtotalPaise: { type: Number, min: 0, default: 0 },
      platformFeePaise: { type: Number, min: 0, default: 0 },
      totalPaise: { type: Number, min: 0, default: 0 },
    },

    timeline: { type: [eventSchema], default: () => [] },

    // Set when the job is handed to the print agent.
    claimedByAgentAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    failureReason: { type: String, trim: true, maxlength: 300, default: null },

    // Kept for support queries: which QR was scanned and from where.
    source: { type: String, enum: ['qr', 'counter', 'app'], default: 'qr' },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, versionKey: false },
    toObject: { virtuals: true, versionKey: false },
  },
);

// Shop dashboards: recent jobs for one tenant.
printOrderSchema.index({ shopId: 1, createdAt: -1 });
// Admin monitoring: recent jobs across the network, and per-machine queues.
printOrderSchema.index({ status: 1, createdAt: -1 });
printOrderSchema.index({ machineId: 1, status: 1, createdAt: -1 });

printOrderSchema.virtual('isPaid').get(function isPaid() {
  return ['paid', 'queued', 'printing', 'completed'].includes(this.status);
});

printOrderSchema.methods.addEvent = function addEvent(
  status,
  { note = null, actor = 'system' } = {},
) {
  this.timeline.push({ status, note, actor, at: new Date() });
  return this;
};

export default model('PrintOrder', printOrderSchema);
