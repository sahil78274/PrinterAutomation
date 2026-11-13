import { Router } from 'express';
import {
  bootstrapAdminHandler,
  register,
  loginHandler,
  refreshHandler,
  logoutHandler,
  meHandler,
  requestPasswordResetHandler,
  confirmPasswordResetHandler,
  changePasswordHandler,
} from '../controllers/authController.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { loginLimiter, passwordResetLimiter, registerLimiter } from '../middleware/rateLimiters.js';
import validate from '../middleware/validate.js';
import {
  validateBootstrapAdmin,
  validateLogin,
  validateRegister,
  validateRefresh,
  validateLogout,
  validatePasswordResetRequest,
  validatePasswordResetConfirm,
  validatePasswordChange,
} from '../validators/authValidator.js';

const router = Router();

/**
 * Authentication endpoints.
 *
 * Rate limits are per-route rather than global: brute-forcing a password and
 * spamming password resets are different attacks and deserve different budgets.
 */

router.post('/register', registerLimiter, validate(validateRegister), register);
router.post('/login', loginLimiter, validate(validateLogin), loginHandler);
router.post('/refresh', validate(validateRefresh), refreshHandler);

// Logout works with a refresh token, or with a live access token plus
// allSessions to end every session on the account.
router.post('/logout', optionalAuth, validate(validateLogout), logoutHandler);

// First-admin bootstrap. Closed unless ADMIN_SETUP_KEY is configured.
router.post(
  '/bootstrap-admin',
  loginLimiter,
  validate(validateBootstrapAdmin),
  bootstrapAdminHandler,
);

router.get('/me', authenticate, meHandler);

router.post(
  '/password/forgot',
  passwordResetLimiter,
  validate(validatePasswordResetRequest),
  requestPasswordResetHandler,
);
router.post(
  '/password/reset',
  passwordResetLimiter,
  validate(validatePasswordResetConfirm),
  confirmPasswordResetHandler,
);
router.post(
  '/password/change',
  authenticate,
  validate(validatePasswordChange),
  changePasswordHandler,
);

export default router;
