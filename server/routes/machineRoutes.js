import { Router } from 'express';
import {
  createMachine,
  getMachineById,
  getMachineDetail,
  getMachineQr,
  listMachines,
  rotateQrHandler,
  updateMachinePricing,
  updateMachineStatus,
} from '../controllers/machineController.js';
import validate from '../middleware/validate.js';
import { publicLimiter } from '../middleware/rateLimiters.js';
import {
  authenticate,
  requirePermission,
  requireShopUser,
  resolveShopScope,
  STAFF_PERMISSIONS,
} from '../middleware/auth.js';
import {
  validateMachineIdParam,
  validateRegisterMachine,
  validateMachineStatus,
  validateMachinePricing,
} from '../validators/machineValidator.js';

const router = Router();

/**
 * Machines.
 *
 * Order matters. The public QR route is declared first and is the only
 * unauthenticated path; everything below requires a session. Static segments
 * (`/all`, `/:machineId/qr`) are declared before `/:machineId` so Express does
 * not treat them as machine ids.
 */

// --- Public: QR resolution ------------------------------------------------
router.get(
  '/:machineId',
  publicLimiter,
  validate(validateMachineIdParam, 'params'),
  getMachineById,
);

// --- Authenticated: shop dashboard and admin ------------------------------
router.get('/', authenticate, requireShopUser, resolveShopScope, listMachines);

router.post(
  '/',
  authenticate,
  requireShopUser,
  resolveShopScope,
  validate(validateRegisterMachine),
  createMachine,
);

router.get(
  '/:machineId/qr',
  authenticate,
  requireShopUser,
  resolveShopScope,
  validate(validateMachineIdParam, 'params'),
  getMachineQr,
);

router.post(
  '/:machineId/qr/rotate',
  authenticate,
  requireShopUser,
  resolveShopScope,
  validate(validateMachineIdParam, 'params'),
  rotateQrHandler,
);

router.get(
  '/:machineId/detail',
  authenticate,
  requireShopUser,
  resolveShopScope,
  validate(validateMachineIdParam, 'params'),
  getMachineDetail,
);

router.patch(
  '/:machineId/status',
  authenticate,
  requireShopUser,
  requirePermission(STAFF_PERMISSIONS.manageMachines),
  resolveShopScope,
  validate(validateMachineIdParam, 'params'),
  validate(validateMachineStatus),
  updateMachineStatus,
);

router.patch(
  '/:machineId/pricing',
  authenticate,
  requireShopUser,
  requirePermission(STAFF_PERMISSIONS.managePricing),
  resolveShopScope,
  validate(validateMachineIdParam, 'params'),
  validate(validateMachinePricing),
  updateMachinePricing,
);

export default router;
