import { Router } from 'express';
import {
  listAgentsHandler,
  listAllShopsHandler,
  listAuditHandler,
  listUsersHandler,
  systemInfoHandler,
  updateShopStatusHandler,
  updateUserStatusHandler,
} from '../controllers/adminController.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import validate from '../middleware/validate.js';
import { validateShopStatus } from '../validators/shopValidator.js';
import { validateUserStatus } from '../validators/adminValidator.js';

const router = Router();

/** Platform administration. Super-admin only, no exceptions. */
router.use(authenticate, requireAdmin);

router.get('/users', listUsersHandler);
router.patch('/users/:userId/status', validate(validateUserStatus), updateUserStatusHandler);

router.get('/shops', listAllShopsHandler);
router.patch('/shops/:shopId/status', validate(validateShopStatus), updateShopStatusHandler);

router.get('/agents', listAgentsHandler);
router.get('/audit', listAuditHandler);
router.get('/system', systemInfoHandler);

export default router;
