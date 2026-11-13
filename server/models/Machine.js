import mongoose from 'mongoose';

const { Schema, model } = mongoose;

/**
 * A Machine is one physical printer, identified platform-wide by `machineId`.
 *
 * The machine ID is the load-bearing part of the product: the QR sticker on the
 * printer encodes /print/<machineId>, and that ID must resolve to exactly one
 * machine forever. It is generated centrally (see services/machineService) and
 * is immutable once issued — re-registering a printer must produce a new ID so
 * old stickers can never silently point at a different device.
 */

const pricingSchema = new Schema(
  {
    currency: { type: String, default: 'INR', maxlength: 3 },
    // Rates are expressed in paise to avoid floating-point money errors.
    bwSinglePaise: { type: Number, min: 0, required: true, default: 200 },
    bwDoublePaise: { type: Number, min: 0, required: true, default: 300 },
    colorSinglePaise: { type: Number, min: 0, default: 0 },
    colorDoublePaise: { type: Number, min: 0, default: 0 },
    // Multiplier for A3 media, applied to per-side rates (stored as basis points).
    a3SurchargeBps: { type: Number, min: 10_000, max: 50_000, default: 16_000 },
    minimumChargePaise: { type: Number, min: 0, default: 500 },
  },
  { _id: false },
);

const printerSchema = new Schema(
  {
    model: { type: String, trim: true, maxlength: 120 },
    supportsColor: { type: Boolean, default: false },
    supportsDuplex: { type: Boolean, default: false },
    paperSizes: {
      type: [{ type: String, enum: ['A4', 'A3', 'Letter', 'Legal'] }],
      default: () => ['A4'],
    },
    maxPaperSize: { type: String, enum: ['A4', 'A3', 'Letter', 'Legal'], default: 'A4' },
    connection: { type: String, enum: ['USB', 'LAN', 'WiFi', 'Network'], default: 'USB' },
  },
  { _id: false },
);

const agentSchema = new Schema(
  {
    // The local Print Agent paired with this machine. Multiple machines of the
    // same shop may share one agent process.
    agentKey: { type: String, trim: true, maxlength: 80, index: true },
    version: { type: String, trim: true, maxlength: 32, default: null },
    hostOs: { type: String, trim: true, maxlength: 60, default: null },
    status: {
      type: String,
      enum: ['unpaired', 'connected', 'disconnected'],
      default: 'unpaired',
      index: true,
    },
    lastSeenAt: { type: Date, default: null },
    queuedJobs: { type: Number, min: 0, default: 0 },
  },
  { _id: false },
);

const machineSchema = new Schema(
  {
    // Globally unique, human-readable identifier printed on the QR sticker.
    machineId: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      // Canonicalise on write, using the same rule as machineService's
      // parseMachineId: the stored form is always SP- plus at least 3 digits.
      // Without this, "sp-42" would be stored as "SP-42" and then fail the
      // match below — i.e. the model would reject an ID it had just derived.
      set: (value) => {
        if (value === null || value === undefined) return value;
        const match = /^SP-(\d{1,6})$/i.exec(String(value).trim());
        return match ? `SP-${match[1].padStart(3, '0')}` : String(value).trim().toUpperCase();
      },
      match: [/^SP-\d{3,6}$/, 'Machine ID must look like SP-001'],
      // Sequence 0 was never issued: allocation starts at 1.
      validate: {
        validator: (value) => Number(String(value).replace('SP-', '')) >= 1,
        message: 'Machine ID sequence must be 1 or greater',
      },
      index: true,
    },

    // Tenant link. Required: a machine that belongs to no shop is a bug.
    shopId: {
      type: Schema.Types.ObjectId,
      ref: 'Shop',
      required: [true, 'A machine must be registered to a shop'],
      index: true,
    },
    // Denormalised shop name for fast admin list rendering.
    shopName: { type: String, trim: true, maxlength: 120 },

    name: { type: String, required: true, trim: true, maxlength: 80 },
    serialNumber: { type: String, trim: true, maxlength: 64 },
    label: { type: String, trim: true, maxlength: 200, default: null },

    status: {
      type: String,
      enum: ['online', 'busy', 'offline', 'maintenance'],
      default: 'offline',
      index: true,
    },

    // Relative path that the QR encodes. Derived, never client-supplied.
    qrPath: { type: String, required: true, maxlength: 120 },

    printer: { type: printerSchema, default: () => ({}) },
    pricing: { type: pricingSchema, default: () => ({}) },
    agent: { type: agentSchema, default: () => ({}) },

    consumables: {
      paperPercent: { type: Number, min: 0, max: 100, default: 100 },
      tonerPercent: { type: Number, min: 0, max: 100, default: 100 },
    },

    jobsToday: { type: Number, min: 0, default: 0 },
    totalJobs: { type: Number, min: 0, default: 0 },

    registeredBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    lastHeartbeatAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, versionKey: false },
    toObject: { virtuals: true, versionKey: false },
  },
);

// Primary dashboard query: the machines of one shop.
machineSchema.index({ shopId: 1, status: 1 });
// Admin fleet view.
machineSchema.index({ status: 1, updatedAt: -1 });

machineSchema.virtual('isAvailable').get(function isAvailable() {
  return ['online', 'busy'].includes(this.status);
});

/**
 * Normalise before validation — not in a 'validate' pre-hook.
 *
 * Setter-level normalisation runs while the value is assigned, so it happens
 * before the `match` regex is evaluated. A pre('validate') hook would run
 * *after* the regex, meaning a lower-case "sp-42" would be rejected before it
 * ever got the chance to be upper-cased. Schema setters are the correct place
 * for this: `uppercase`/`trim` on the path already do the same job, and doing
 * it explicitly additionally keeps `qrPath` in lock-step with `machineId`.
 */
machineSchema.pre('validate', function deriveQrPath(next) {
  // qrPath is always derived from machineId so the two can never disagree.
  if (this.machineId) this.qrPath = `/print/${this.machineId}`;
  next();
});

export default model('Machine', machineSchema);
