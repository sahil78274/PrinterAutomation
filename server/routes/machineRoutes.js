import { Router } from 'express';
import { createMachine, getMachineById, listMachines } from '../controllers/machineController.js';
import validate from '../middleware/validate.js';
import requireDatabase from '../middleware/requireDatabase.js';
import devOnlyAdmin from '../middleware/devOnly.js';
import { publicLimiter } from '../middleware/rateLimiters.js';
import { validateMachineIdParam, validateRegisterMachine } from '../validators/machineValidator.js';

const router = Router();

/**
 * Public QR resolution — the hottest endpoint in the product and the only one
 * an unauthenticated customer hits before ordering.
 */
router.get(
  '/:machineId',
  publicLimiter,
  // Validate the shape before touching infrastructure: a malformed ID is a
  // client error (422) regardless of whether the database happens to be up.
  validate(validateMachineIdParam, 'params'),
  requireDatabase,
  getMachineById,
);

/**
 * Shop-scoped listing. Requires an explicit shopId so a missing filter can never
 * turn into a cross-tenant dump.
 */
router.get('/', requireDatabase, listMachines);

/**
 * Registration. Admin-scoped; guarded by devOnlyAdmin until authentication
 * lands in Phase 3.
 */
router.post('/', devOnlyAdmin, validate(validateRegisterMachine), requireDatabase, createMachine);

export default router;
