import { Router } from 'express';
import {
  downloadOrdersCsv,
  getPlatformAnalytics,
  getShopAnalytics,
} from '../controllers/analyticsController.js';
import { authenticate, requireAdmin, requireShopUser } from '../middleware/auth.js';

const router = Router();

/**
 * Analytics.
 *
 * Two audiences, two endpoints. The shop endpoint derives its tenant from the
 * session and takes no shop id at all, so there is nothing to tamper with.
 */

router.use(authenticate);

router.get('/shop', requireShopUser, getShopAnalytics);
router.get('/orders.csv', requireShopUser, downloadOrdersCsv);
router.get('/platform', requireAdmin, getPlatformAnalytics);

export default router;
