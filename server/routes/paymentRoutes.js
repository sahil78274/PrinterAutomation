import { Router } from 'express';
import {
  getProviderHandler,
  listPaymentsHandler,
  webhookHandler,
} from '../controllers/paymentController.js';
import { authenticate, requireShopUser } from '../middleware/auth.js';
import { publicLimiter } from '../middleware/rateLimiters.js';

const router = Router();

/**
 * Payments.
 *
 * The provider description is public so a client can discover that this build
 * simulates payments before it tries to take one. The webhook is public by
 * necessity and is authenticated by HMAC signature instead.
 */

router.get('/provider', getProviderHandler);
router.post('/webhook', publicLimiter, webhookHandler);

router.use(authenticate, requireShopUser);
router.get('/', listPaymentsHandler);

export default router;
