import { Router } from 'express';
import {
  createOrderHandler,
  getOrderHandler,
  cancelOrderHandler,
  beginPaymentHandler,
  confirmPaymentHandler,
  listOrdersHandler,
} from '../controllers/orderController.js';
import {
  authenticate,
  optionalAuth,
  requireShopUser,
  resolveShopScope,
} from '../middleware/auth.js';
import { orderLimiter, publicLimiter } from '../middleware/rateLimiters.js';
import validate from '../middleware/validate.js';
import {
  validateCreateOrder,
  validateBeginPayment,
  validateConfirmPayment,
  validateCancelOrder,
} from '../validators/orderValidator.js';

const router = Router();

/**
 * Orders.
 *
 * `GET /` is the shop dashboard listing and sits behind authentication + tenancy.
 * The rest of the namespace is the public customer flow, reached by possession
 * of an unguessable order id. They are declared separately so the auth
 * requirement on the listing cannot be bypassed by path confusion.
 */

// Shop dashboard listing — authenticated, tenant-scoped.
router.get('/', authenticate, requireShopUser, resolveShopScope, listOrdersHandler);

// Customer flow — no account required.
router.post('/', orderLimiter, optionalAuth, validate(validateCreateOrder), createOrderHandler);
router.get('/:orderId', publicLimiter, getOrderHandler);
router.post('/:orderId/pay', orderLimiter, validate(validateBeginPayment), beginPaymentHandler);
router.post(
  '/:orderId/confirm',
  orderLimiter,
  optionalAuth,
  validate(validateConfirmPayment),
  confirmPaymentHandler,
);
router.post('/:orderId/cancel', orderLimiter, validate(validateCancelOrder), cancelOrderHandler);

export default router;
