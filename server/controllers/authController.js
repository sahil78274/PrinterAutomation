import { timingSafeEqual } from 'node:crypto';
import config from '../config/index.js';
import asyncHandler from '../utils/asyncHandler.js';
import { sendSuccess, sendCreated } from '../utils/apiResponse.js';
import ApiError from '../utils/ApiError.js';
import * as authService from '../services/authService.js';
import { revokeRefreshToken } from '../services/tokenService.js';
import { audit } from '../services/auditService.js';

/**
 * Auth HTTP layer. No business rules here — validation, hashing and token
 * handling all live in the services.
 */

const userAgentOf = (req) => req.headers['user-agent'] ?? null;

export const register = asyncHandler(async (req, res) => {
  const result = await authService.registerShopOwner({
    ...req.body,
    userAgent: userAgentOf(req),
  });

  await audit(req, {
    action: 'auth.register',
    entity: 'user',
    entityId: result.user.id,
    shopId: result.shop?.id ?? null,
    metadata: { email: result.user.email },
  });

  return sendCreated(res, result);
});

export const loginHandler = asyncHandler(async (req, res) => {
  const result = await authService.login({ ...req.body, userAgent: userAgentOf(req) });

  await audit(req, {
    action: 'auth.login',
    entity: 'user',
    entityId: result.user.id,
    shopId: result.user.shopId ?? null,
  });

  return sendSuccess(res, result);
});

export const refreshHandler = asyncHandler(async (req, res) => {
  const result = await authService.refresh({
    refreshToken: req.body.refreshToken,
    userAgent: userAgentOf(req),
  });
  return sendSuccess(res, result);
});

export const logoutHandler = asyncHandler(async (req, res) => {
  const { refreshToken, allSessions = false } = req.body;

  if (allSessions && req.auth) {
    const { revokeAllForUser } = await import('../services/tokenService.js');
    await revokeAllForUser(req.auth.userId);
  } else if (refreshToken) {
    await revokeRefreshToken(refreshToken);
  } else {
    throw ApiError.badRequest('Provide a refreshToken, or set allSessions with a valid session', {
      code: 'REFRESH_TOKEN_REQUIRED',
    });
  }

  await audit(req, { action: 'auth.logout', entity: 'user', entityId: req.auth?.userId ?? null });
  return sendSuccess(res, { loggedOut: true });
});

export const meHandler = asyncHandler(async (req, res) => {
  const profile = await authService.getProfile(req.auth.userId);
  return sendSuccess(res, profile);
});

export const requestPasswordResetHandler = asyncHandler(async (req, res) => {
  // Always 200: whether the address exists is not disclosed.
  const result = await authService.requestPasswordReset({ email: req.body.email });
  return sendSuccess(res, result);
});

export const confirmPasswordResetHandler = asyncHandler(async (req, res) => {
  const result = await authService.confirmPasswordReset({
    token: req.body.token,
    password: req.body.password,
  });
  await audit(req, { action: 'auth.password_reset_confirmed', entity: 'user' });
  return sendSuccess(res, result);
});

export const changePasswordHandler = asyncHandler(async (req, res) => {
  const result = await authService.changePassword({
    userId: req.auth.userId,
    currentPassword: req.body.currentPassword,
    newPassword: req.body.newPassword,
  });
  await audit(req, { action: 'auth.password_changed', entity: 'user', entityId: req.auth.userId });
  return sendSuccess(res, result);
});

/**
 * POST /api/auth/bootstrap-admin
 *
 * Creates the very first platform administrator.
 *
 * Three conditions, all required:
 *   1. ADMIN_SETUP_KEY is configured (otherwise this route is closed).
 *   2. The supplied key matches, compared in constant time.
 *   3. No admin exists yet OR the key matches — the key is the authorisation,
 *      so an operator can deliberately provision a second admin in a runbook.
 *
 * The route is rate limited like every other auth endpoint, and the key is
 * compared with timingSafeEqual so a wrong key cannot be discovered by timing.
 */
export const bootstrapAdminHandler = asyncHandler(async (req, res) => {
  // Read at request time, not at boot: an operator may set or rotate the key
  // without a redeploy, and a test can supply it after importing the app.
  const configured = process.env.ADMIN_SETUP_KEY || config.auth.adminSetupKey;

  if (!configured) {
    // 404 rather than 403: an unconfigured deployment should not advertise that
    // a privileged bootstrap endpoint exists at all.
    throw ApiError.notFound('Not found', { code: 'NOT_FOUND' });
  }

  const supplied = String(req.body?.setupKey ?? '');
  const expected = String(configured);

  // Length must match before timingSafeEqual, or it throws.
  const suppliedBuffer = Buffer.from(supplied.padEnd(expected.length, '\0'));
  const expectedBuffer = Buffer.from(expected.padEnd(supplied.length, '\0'));

  const matches =
    supplied.length === expected.length &&
    suppliedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(suppliedBuffer, expectedBuffer);

  if (!matches) {
    throw ApiError.unauthorized('Invalid setup key', { code: 'INVALID_SETUP_KEY' });
  }

  const { user, created } = await authService.createAdmin({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
  });

  await audit(req, {
    action: created ? 'auth.admin_bootstrapped' : 'auth.admin_bootstrap_existing',
    entity: 'user',
    entityId: user.id,
  });

  return created ? sendCreated(res, { user, created }) : sendSuccess(res, { user, created });
});
