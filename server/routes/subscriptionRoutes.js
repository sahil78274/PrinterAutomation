import { Router } from 'express';
import {
  cancelHandler,
  changePlanHandler,
  getCurrentHandler,
  getShopSubscriptionHandler,
  issueInvoiceHandler,
  listPlansHandler,
} from '../controllers/subscriptionController.js';
import { authenticate, requireAdmin, requireRole } from '../middleware/auth.js';
import validate from '../middleware/validate.js';
import {
  validateChangePlan,
  validateCancelSubscription,
} from '../validators/subscriptionValidator.js';

const router = Router();

/**
 * Subscriptions.
 *
 * The price list is public — a customer evaluating the platform needs it. Every
 * other route belongs to an authenticated owner.
 */

router.get('/plans', listPlansHandler);

router.use(authenticate);

router.get('/current', requireRole('owner', 'admin'), getCurrentHandler);
router.post(
  '/plan',
  requireRole('owner', 'admin'),
  validate(validateChangePlan),
  changePlanHandler,
);
router.post('/invoices', requireRole('owner', 'admin'), issueInvoiceHandler);
router.post(
  '/cancel',
  requireRole('owner', 'admin'),
  validate(validateCancelSubscription),
  cancelHandler,
);

router.get('/shops/:identifier', requireAdmin, getShopSubscriptionHandler);

export default router;
