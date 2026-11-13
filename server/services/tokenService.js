import jwt from 'jsonwebtoken';
import { randomBytes } from 'node:crypto';
import config from '../config/index.js';
import ApiError from '../utils/ApiError.js';
import { generateOpaqueToken, hashToken } from './passwordService.js';
import { getRepository } from '../repositories/active.js';

/**
 * Access and refresh tokens.
 *
 * Design:
 *  - **Access token** is a short-lived (15 min) signed JWT carrying the user id,
 *    role and shopId. Stateless, so the common request path does no database
 *    read. Short TTL is what limits the damage of a stolen token.
 *  - **Refresh token** is an opaque random string, stored *hashed*, rotated on
 *    every use. Rotation is what makes theft detectable: if a used token is
 *    presented again, the whole family is revoked.
 *  - Role and shopId live in the access token, but every authorization check
 *    also re-reads the user when the request mutates data, so a demoted or
 *    suspended account cannot keep acting until its token expires.
 */

const EPHEMERAL_SECRET = randomBytes(48).toString('hex');

function secret() {
  return config.auth.jwtSecret || EPHEMERAL_SECRET;
}

/** Values that may travel in a JWT. Never include anything secret. */
function claimsFor(user) {
  return {
    sub: user.id,
    role: user.role,
    shopId: user.shopId ?? null,
    // Bumped whenever the user's authorization changes, to invalidate old tokens.
    tokenVersion: user.tokenVersion ?? 0,
  };
}

export function issueAccessToken(user) {
  return jwt.sign(claimsFor(user), secret(), {
    expiresIn: config.auth.accessTokenTtl,
    issuer: config.auth.issuer,
    audience: config.auth.audience,
  });
}

/**
 * Verify an access token.
 * Throws ApiError(401) for anything unusable — expiry, tampering, wrong issuer.
 */
export function verifyAccessToken(token) {
  try {
    return jwt.verify(token, secret(), {
      issuer: config.auth.issuer,
      audience: config.auth.audience,
    });
  } catch (error) {
    const expired = error.name === 'TokenExpiredError';
    throw new ApiError(401, expired ? 'Session expired. Please sign in again.' : 'Invalid token', {
      code: expired ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN',
    });
  }
}

/**
 * Create a refresh token and persist its digest.
 * Returns the raw token exactly once — it is never retrievable afterwards.
 */
export async function issueRefreshToken(user, { familyId = null, userAgent = null } = {}) {
  const token = generateOpaqueToken();
  const family = familyId ?? randomBytes(16).toString('hex');
  const expiresAt = new Date(
    Date.now() + config.auth.refreshTokenTtlDays * 24 * 60 * 60 * 1000,
  ).toISOString();

  await getRepository().insert('refreshTokens', {
    userId: user.id,
    shopId: user.shopId ?? null,
    tokenHash: hashToken(token),
    familyId: family,
    userAgent,
    expiresAt,
    revokedAt: null,
    usedAt: null,
    replacedByHash: null,
  });

  return { token, familyId: family, expiresAt };
}

/**
 * Redeem a refresh token, rotating it.
 *
 * Reuse of an already-redeemed token is treated as theft: the entire token
 * family is revoked, forcing a fresh login. That is the standard rotation
 * defence and the reason `usedAt` is recorded rather than deleting the row.
 */
export async function rotateRefreshToken(rawToken, { userAgent = null } = {}) {
  const repo = getRepository();
  const record = await repo.findOne('refreshTokens', { tokenHash: hashToken(rawToken) });

  if (!record) {
    throw ApiError.unauthorized('Invalid refresh token', { code: 'INVALID_REFRESH_TOKEN' });
  }

  if (record.revokedAt) {
    throw ApiError.unauthorized('Session has been revoked. Please sign in again.', {
      code: 'REFRESH_TOKEN_REVOKED',
    });
  }

  if (record.usedAt) {
    // Replay. Kill the family; something is wrong.
    await revokeFamily(record.familyId);
    throw ApiError.unauthorized('Refresh token has already been used. Please sign in again.', {
      code: 'REFRESH_TOKEN_REUSED',
    });
  }

  if (new Date(record.expiresAt).getTime() < Date.now()) {
    throw ApiError.unauthorized('Session expired. Please sign in again.', {
      code: 'REFRESH_TOKEN_EXPIRED',
    });
  }

  const user = await repo.findById('users', record.userId);
  if (!user || user.status !== 'active') {
    await revokeFamily(record.familyId);
    throw ApiError.unauthorized('Account is not active', { code: 'ACCOUNT_INACTIVE' });
  }

  const next = await issueRefreshToken(user, { familyId: record.familyId, userAgent });

  await repo.updateById('refreshTokens', record.id, {
    usedAt: new Date().toISOString(),
    replacedByHash: hashToken(next.token),
  });

  return {
    user,
    accessToken: issueAccessToken(user),
    refreshToken: next.token,
    refreshTokenExpiresAt: next.expiresAt,
  };
}

/** Revoke one token (logout). No-op when it is already gone. */
export async function revokeRefreshToken(rawToken) {
  const repo = getRepository();
  const record = await repo.findOne('refreshTokens', { tokenHash: hashToken(rawToken) });
  if (!record || record.revokedAt) return { revoked: 0 };
  await repo.updateById('refreshTokens', record.id, { revokedAt: new Date().toISOString() });
  return { revoked: 1 };
}

export async function revokeFamily(familyId) {
  const repo = getRepository();
  const tokens = await repo.findAll('refreshTokens', { familyId });
  await Promise.all(
    tokens
      .filter((token) => !token.revokedAt)
      .map((token) =>
        repo.updateById('refreshTokens', token.id, { revokedAt: new Date().toISOString() }),
      ),
  );
  return tokens.length;
}

/** Logout everywhere. */
export async function revokeAllForUser(userId) {
  const repo = getRepository();
  const tokens = await repo.findAll('refreshTokens', { userId });
  await Promise.all(
    tokens
      .filter((token) => !token.revokedAt)
      .map((token) =>
        repo.updateById('refreshTokens', token.id, { revokedAt: new Date().toISOString() }),
      ),
  );

  // Also invalidate every issued access token for this user.
  const user = await repo.findById('users', userId);
  if (user) {
    await repo.updateById('users', userId, { tokenVersion: (user.tokenVersion ?? 0) + 1 });
  }
  return tokens.length;
}
