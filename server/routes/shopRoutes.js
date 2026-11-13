import { Router } from 'express';
import {
  approveShopHandler,
  createShopHandler,
  getMyShopHandler,
  getShopHandler,
  listShopsHandler,
  updateShopStatusHandler,
} from '../controllers/shopController.js';
import validate from '../middleware/validate.js';
import {
  authenticate,
  requireRole,
  requireShopUser,
  resolveShopScope,
} from '../middleware/auth.js';
import { validateCreateShop, validateShopStatus } from '../validators/shopValidator.js';

const router = Router();

/**
 * Shops.
 *
 * Every route here requires a session; there is no anonymous shop listing.
 * `/me` is declared before `/:identifier` so it is not swallowed as a shop code.
 */

router.use(authenticate);

router.get('/me', requireShopUser, getMyShopHandler);

router.post('/', requireRole('admin'), validate(validateCreateShop), createShopHandler);

router.get('/', listShopsHandler);

router.post('/:identifier/approve', requireRole('admin'), approveShopHandler);

router.patch(
  '/:identifier/status',
  requireRole('admin'),
  validate(validateShopStatus),
  updateShopStatusHandler,
);

// Declared last: `/:identifier` matches anything, so it must not shadow the rest.
router.get('/:identifier', requireShopUser, resolveShopScope, getShopHandler);

export default router;
