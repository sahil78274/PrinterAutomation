import mongoose from 'mongoose';

const { Schema, model } = mongoose;

/**
 * Platform user. Three roles, enforced at the API layer:
 *
 *   shop      — scoped to exactly one shopId; can read/write that tenant only
 *   staff     — same scope as shop, for counter staff (limited write rights)
 *   admin     — platform operator; the only role allowed to list across tenants
 *
 * Phase 2 ships the model only. Password hashing, login and token issuance are
 * Phase 3 work; `passwordHash` is deliberately excluded from queries by default
 * so it can never leak through a careless `res.json(user)`.
 */

/**
 * Strip the password hash on the way out.
 *
 * `select: false` only protects queries that go through the database; a value
 * set in memory (or fetched with an explicit `.select('+passwordHash')`) would
 * still be serialised. Removing it in the transform is the guarantee, and it
 * covers `res.json(user)` — the mistake this model's comments warn about.
 */
function stripPasswordHash(_doc, ret) {
  delete ret.passwordHash;
  return ret;
}

const userSchema = new Schema(
  {
    name: { type: String, required: [true, 'Name is required'], trim: true, maxlength: 120 },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 160,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Email format is invalid'],
    },
    phone: { type: String, trim: true, maxlength: 20, default: null },

    // Never selected by default; populated only by the auth service.
    passwordHash: {
      type: String,
      select: false,
      default: null,
    },

    role: {
      type: String,
      enum: ['shop', 'staff', 'admin'],
      required: true,
      default: 'shop',
      index: true,
    },

    // Required for shop/staff, must be null for admin.
    //
    // Enforced with a field validator rather than a pre('validate') hook that
    // calls next(new Error(...)): this produces a proper mongoose ValidationError,
    // which the error middleware maps to a 422 with a field-level message. A
    // generic Error would surface as a 500 and blame the server for bad input.
    shopId: {
      type: Schema.Types.ObjectId,
      ref: 'Shop',
      default: null,
      index: true,
      validate: {
        validator(value) {
          const needsShop = this.role === 'shop' || this.role === 'staff';
          if (needsShop) return Boolean(value);
          if (this.role === 'admin') return !value;
          return true;
        },
        message:
          'Shop and staff accounts must be linked to a shopId, and admin accounts must not be',
      },
    },

    title: { type: String, trim: true, maxlength: 60, default: null },

    status: {
      type: String,
      enum: ['invited', 'active', 'disabled'],
      default: 'invited',
      index: true,
    },

    lastLoginAt: { type: Date, default: null },
    // Prepared for Phase 3: failed-login lockout and password rotation.
    failedLoginAttempts: { type: Number, default: 0, min: 0 },
    lockedUntil: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, versionKey: false, transform: stripPasswordHash },
    toObject: { virtuals: true, versionKey: false, transform: stripPasswordHash },
  },
);

userSchema.index({ shopId: 1, role: 1 });

export default model('User', userSchema);
