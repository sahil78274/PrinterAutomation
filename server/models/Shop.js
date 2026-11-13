import mongoose from 'mongoose';

const { Schema, model } = mongoose;

/**
 * A Shop is a tenant: an independent print business on the platform.
 *
 * Isolation rule: every collection that belongs to a shop carries `shopId`, and
 * every non-admin query must filter by it. That single convention is what makes
 * the platform multi-tenant.
 */

const addressSchema = new Schema(
  {
    line1: { type: String, trim: true, maxlength: 200 },
    line2: { type: String, trim: true, maxlength: 200 },
    city: { type: String, trim: true, maxlength: 80 },
    state: { type: String, trim: true, maxlength: 80 },
    pincode: { type: String, trim: true, maxlength: 12 },
    country: { type: String, trim: true, maxlength: 80, default: 'India' },
  },
  { _id: false },
);

const payoutSchema = new Schema(
  {
    method: { type: String, enum: ['upi', 'bank'], default: 'upi' },
    // Never store full account numbers. Only a masked reference is kept.
    handle: { type: String, trim: true, maxlength: 120 },
    cycle: { type: String, enum: ['T+1', 'T+2', 'T+3', 'weekly'], default: 'T+2' },
    // Settlement is a Phase 4 concern; the account must be verified first.
    verified: { type: Boolean, default: false },
  },
  { _id: false },
);

const settingsSchema = new Schema(
  {
    acceptOrders: { type: Boolean, default: true },
    requirePaymentBeforePrint: { type: Boolean, default: true },
    maxUploadMb: { type: Number, min: 1, max: 100, default: 25 },
    autoCancelMinutes: { type: Number, min: 5, max: 180, default: 20 },
    notifyOnJobComplete: { type: Boolean, default: true },
  },
  { _id: false },
);

const shopSchema = new Schema(
  {
    // Human-facing tenant reference used in URLs and support tickets, e.g. SH-8F2K1.
    shopCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      maxlength: 20,
      index: true,
    },

    name: { type: String, required: [true, 'Shop name is required'], trim: true, maxlength: 120 },
    ownerName: {
      type: String,
      required: [true, 'Owner name is required'],
      trim: true,
      maxlength: 120,
    },
    email: {
      type: String,
      required: [true, 'Shop email is required'],
      lowercase: true,
      trim: true,
      maxlength: 160,
      index: true,
      // Presence alone is not enough: this address receives order receipts and
      // is how the shop is contacted, so a typo must fail at write time.
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, 'Shop email must be a valid email address'],
    },
    phone: { type: String, required: [true, 'Shop phone is required'], trim: true, maxlength: 20 },

    address: { type: addressSchema, default: () => ({}) },
    gstin: { type: String, trim: true, uppercase: true, maxlength: 20 },
    timezone: { type: String, default: 'Asia/Kolkata', maxlength: 60 },
    openHours: { type: String, trim: true, maxlength: 60, default: '09:00 – 21:00' },

    planId: {
      type: String,
      enum: ['starter', 'growth', 'scale'],
      default: 'starter',
      index: true,
    },
    planStatus: {
      type: String,
      enum: ['trial', 'active', 'past_due', 'cancelled'],
      default: 'trial',
      index: true,
    },
    planRenewsOn: { type: Date, default: null },

    settings: { type: settingsSchema, default: () => ({}) },
    payout: { type: payoutSchema, default: () => ({}) },

    status: {
      type: String,
      enum: ['active', 'suspended', 'closed'],
      default: 'active',
      index: true,
    },

    // Denormalised counters, maintained by services rather than by hand.
    machineCount: { type: Number, default: 0, min: 0 },
    onlineMachineCount: { type: Number, default: 0, min: 0 },
    lifetimeRevenue: { type: Number, default: 0, min: 0 },

    rating: { type: Number, min: 0, max: 5, default: null },
    reviewCount: { type: Number, min: 0, default: 0 },

    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, versionKey: false },
    toObject: { virtuals: true, versionKey: false },
  },
);

// A shop can share a support email with another branch, but the name + city
// combination must stay distinct so staff can tell them apart.
shopSchema.index({ name: 1, 'address.city': 1 });
// Supports the admin shop list filtered by plan and status.
shopSchema.index({ planStatus: 1, status: 1, createdAt: -1 });

shopSchema.virtual('isAcceptingOrders').get(function isAcceptingOrders() {
  return (
    this.status === 'active' &&
    this.settings?.acceptOrders === true &&
    this.planStatus !== 'cancelled'
  );
});

export default model('Shop', shopSchema);
