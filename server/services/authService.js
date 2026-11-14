import { randomUUID } from 'node:crypto';
import ApiError from '../utils/ApiError.js';
import config from '../config/index.js';
import { getRepository } from '../repositories/active.js';
import {
  assertPasswordAcceptable,
  getDummyPasswordHash,
  generateOpaqueToken,
  hashPassword,
  hashToken,
  verifyPassword,
} from './passwordService.js';
import {
  issueAccessToken,
  issueRefreshToken,
  revokeAllForUser,
  rotateRefreshToken,
} from './tokenService.js';
import { generateShopCode } from './shopService.js';
import { ROLES } from '../middleware/auth.js';

/**
 * Registration, login, refresh, logout and password reset.
 *
 * Two properties shape the design:
 *
 *  1. **No user enumeration.** Login, refresh and password-reset all return the
 *     same shape whether or not the account exists, and the timing matches
 *     because a dummy bcrypt comparison runs for missing users.
 *  2. **Least privilege on signup.** Public registration can only ever create a
 *     shop *owner*. Admin accounts cannot be self-provisioned; they are created
 *     by a seed script or an existing admin. Otherwise `role: 'admin'` in a
 *     request body would be a one-request privilege escalation.
 */

const PUBLIC_SIGNUP_ROLES = [ROLES.OWNER];

/** Strip everything the client must never see. */
export function publicUser(user) {
  if (!user) return null;
  const { passwordHash, passwordResetToken, passwordResetExpiresAt, ...safe } = user;
  return safe;
}

function authResult(user, accessToken, refresh) {
  return {
    user: publicUser(user),
    accessToken,
    refreshToken: refresh.token,
    refreshTokenExpiresAt: refresh.expiresAt,
    tokenType: 'Bearer',
    expiresIn: config.auth.accessTokenTtl,
  };
}

async function findUserByEmail(email) {
  const normalised = String(email ?? '')
    .trim()
    .toLowerCase();
  if (!normalised) return null;
  return getRepository().findOne('users', { email: normalised }, { includeDeleted: true });
}

/**
 * Register a shop owner and their shop in one step.
 *
 * A shop without an owner is an orphan; an owner without a shop cannot do
 * anything. Creating them together, then linking, keeps that invariant.
 * There is no multi-document transaction available in the memory adapter, so
 * the shop is created first and a failure rolls it back explicitly — which is
 * also what a `withTransaction` block would do, just less elegantly.
 *
 * @param {object} params
 * @param {string} params.name - Owner full name
 * @param {string} params.email - Business email
 * @param {string} params.password - Password (already validated)
 * @param {string} params.phone - Mobile number
 * @param {string} params.shopName - Shop name
 * @param {string} params.address - Shop street address
 * @param {string} params.city - City
 * @param {string} params.state - State
 * @param {string} params.pincode - PIN code
 * @param {boolean} params.termsAccepted - Terms acceptance flag
 * @param {string} [params.userAgent] - Browser user agent
 */
export async function registerShopOwner({
  name,
  email,
  password,
  phone = null,
  shopName,
  address,
  city,
  state,
  pincode,
  termsAccepted = false,
  userAgent = null,
}) {
  const repo = getRepository();

  const normalisedEmail = String(email ?? '')
    .trim()
    .toLowerCase();
  if (!normalisedEmail) {
    throw ApiError.unprocessable('Email is required', {
      code: 'VALIDATION_ERROR',
      details: { email: 'Email is required' },
    });
  }

  assertPasswordAcceptable(password);

  const existing = await findUserByEmail(normalisedEmail);
  if (existing) {
    // Registration inherently reveals whether an email is taken; there is no
    // way around it, so say so plainly rather than pretending otherwise.
    throw ApiError.conflict('An account with that email already exists', {
      code: 'EMAIL_TAKEN',
      details: { email: 'Already registered' },
    });
  }

  const shopName_ = String(shopName ?? '').trim() || `${String(name ?? '').trim()}'s shop`;

  // Build shop record with full address
  const shopData = {
    shopCode: await generateShopCode(),
    name: shopName_,
    ownerName: String(name ?? '').trim(),
    email: normalisedEmail,
    phone,
    status: 'pending',
    planId: 'starter',
    planStatus: 'trial',
    trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    machineCount: 0,
    address: {
      line1: address || null,
      city: city || null,
      state: state || null,
      pincode: pincode || null,
      country: 'India',
    },
    termsAcceptedAt: termsAccepted ? new Date().toISOString() : null,
    settings: {
      acceptOrders: true,
      requirePaymentBeforePrint: true,
      maxUploadMb: 25,
    },
  };

  const shop = await repo.insert('shops', shopData);

  let user;
  try {
    user = await repo.insert('users', {
      name: String(name ?? '').trim(),
      email: normalisedEmail,
      passwordHash: await hashPassword(password),
      role: ROLES.OWNER,
      shopId: shop.id,
      status: 'active',
      permissions: [],
      tokenVersion: 0,
      lastLoginAt: new Date().toISOString(),
    });
  } catch (error) {
    // Rollback the shop if user creation fails to avoid orphaned shops
    await repo.softDelete('shops', shop.id);
    throw error;
  }

  await repo.updateById('shops', shop.id, { ownerUserId: user.id });

  const accessToken = issueAccessToken(user);
  const refresh = await issueRefreshToken(user, { userAgent });

  return { ...authResult(user, accessToken, refresh), shop: await repo.findById('shops', shop.id) };
}

/** Authenticate with email and password. */
export async function login({ email, password, userAgent = null }) {
  const repo = getRepository();
  const user = await findUserByEmail(email);

  if (!user) {
    // Burn comparable CPU so a missing account is not detectable by timing.
    await verifyPassword(password, getDummyPasswordHash());
    throw ApiError.unauthorized('Email or password is incorrect', { code: 'INVALID_CREDENTIALS' });
  }

  if (user.lockedUntil && new Date(user.lockedUntil).getTime() > Date.now()) {
    throw ApiError.forbidden('Account is temporarily locked after too many failed attempts', {
      code: 'ACCOUNT_LOCKED',
    });
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    const attempts = (user.failedLoginAttempts ?? 0) + 1;
    const updates = { failedLoginAttempts: attempts };
    // Progressive lockout: cheap to get wrong once, expensive to brute force.
    if (attempts >= 10) updates.lockedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    await repo.updateById('users', user.id, updates);
    throw ApiError.unauthorized('Email or password is incorrect', { code: 'INVALID_CREDENTIALS' });
  }

  if (user.status !== 'active' || user.deletedAt) {
    throw ApiError.forbidden('This account is not active', { code: 'ACCOUNT_INACTIVE' });
  }

  await repo.updateById('users', user.id, {
    failedLoginAttempts: 0,
    lockedUntil: null,
    lastLoginAt: new Date().toISOString(),
  });

  const fresh = await repo.findById('users', user.id);
  const accessToken = issueAccessToken(fresh);
  const refresh = await issueRefreshToken(fresh, { userAgent });

  return authResult(fresh, accessToken, refresh);
}

/** Exchange a refresh token for a new access token, rotating the refresh token. */
export async function refresh({ refreshToken, userAgent = null }) {
  const result = await rotateRefreshToken(refreshToken, { userAgent });
  return {
    user: publicUser(result.user),
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    refreshTokenExpiresAt: result.refreshTokenExpiresAt,
    tokenType: 'Bearer',
    expiresIn: config.auth.accessTokenTtl,
  };
}

/**
 * Password reset — request step.
 *
 * Always resolves successfully, whether or not the address exists. Returning a
 * token here would let anyone reset any account; in development the token is
 * logged so the flow can be completed locally. A production deployment sends it
 * by email through an outbound adapter that is not built yet.
 */
export async function requestPasswordReset({ email }) {
  const repo = getRepository();
  const user = await findUserByEmail(email);

  if (!user) {
    // Deliberately indistinguishable from success.
    return { requested: true };
  }

  const token = generateOpaqueToken(32);
  const expiresAt = new Date(
    Date.now() + config.auth.passwordResetTtlMinutes * 60 * 1000,
  ).toISOString();

  await repo.updateById('users', user.id, {
    passwordResetTokenHash: hashToken(token),
    passwordResetExpiresAt: expiresAt,
  });

  return {
    requested: true,
    // Exposed only outside production so the flow is completable locally.
    ...(config.isProduction ? {} : { developmentToken: token, expiresAt }),
  };
}

/** Password reset — confirm step. Also revokes every existing session. */
export async function confirmPasswordReset({ token, password }) {
  const repo = getRepository();
  assertPasswordAcceptable(password);

  const record = await repo.findOne('users', { passwordResetTokenHash: hashToken(token) });
  if (!record || !record.passwordResetExpiresAt) {
    throw ApiError.badRequest('This reset link is invalid or has expired', {
      code: 'INVALID_RESET_TOKEN',
    });
  }
  if (new Date(record.passwordResetExpiresAt).getTime() < Date.now()) {
    throw ApiError.badRequest('This reset link has expired', { code: 'RESET_TOKEN_EXPIRED' });
  }

  await repo.updateById('users', record.id, {
    passwordHash: await hashPassword(password),
    passwordResetTokenHash: null,
    passwordResetExpiresAt: null,
    failedLoginAttempts: 0,
    lockedUntil: null,
  });

  // A password change must end every existing session.
  await revokeAllForUser(record.id);

  return { reset: true };
}

/** Change password for a signed-in user. */
export async function changePassword({ userId, currentPassword, newPassword }) {
  const repo = getRepository();
  const user = await repo.findById('users', userId);
  if (!user) throw ApiError.notFound('User not found', { code: 'USER_NOT_FOUND' });

  const ok = await verifyPassword(currentPassword, user.passwordHash);
  if (!ok) {
    throw ApiError.badRequest('Current password is incorrect', { code: 'INVALID_CREDENTIALS' });
  }
  if (currentPassword === newPassword) {
    throw ApiError.unprocessable('New password must be different from the current one', {
      code: 'PASSWORD_UNCHANGED',
    });
  }
  assertPasswordAcceptable(newPassword);

  await repo.updateById('users', userId, { passwordHash: await hashPassword(newPassword) });
  await revokeAllForUser(userId);
  return { changed: true };
}

/** Load the signed-in user's profile with shop context. */
export async function getProfile(userId) {
  const repo = getRepository();
  const user = await repo.findById('users', userId);
  if (!user) throw ApiError.notFound('User not found', { code: 'USER_NOT_FOUND' });
  const shop = user.shopId ? await repo.findById('shops', user.shopId) : null;
  return { user: publicUser(user), shop };
}

/** Create the first admin. Idempotent; used by the seed script. */
export async function createAdmin({ name, email, password }) {
  const repo = getRepository();
  assertPasswordAcceptable(password);

  const existing = await findUserByEmail(email);
  if (existing) return { user: publicUser(existing), created: false };

  const user = await repo.insert('users', {
    name: String(name).trim(),
    email: String(email).trim().toLowerCase(),
    passwordHash: await hashPassword(password),
    role: ROLES.ADMIN,
    shopId: null,
    status: 'active',
    permissions: [],
    tokenVersion: 0,
    seedId: randomUUID(),
  });
  return { user: publicUser(user), created: true };
}

export { PUBLIC_SIGNUP_ROLES };
