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
