import { Router } from 'express';
import {
  createStaffHandler,
  deactivateStaffHandler,
  listPermissionsHandler,
  listStaffHandler,
  updateStaffHandler,
} from '../controllers/staffController.js';
import { authenticate, requireShopUser, requireRole } from '../middleware/auth.js';
import validate from '../middleware/validate.js';
import { validateCreateStaff, validateUpdateStaff } from '../validators/staffValidator.js';

const router = Router();

/**
 * Staff management.
 *
 * Owner-only, plus admins. `requireRole('owner', 'admin')` is checked before any
 * handler runs, so a staff account holding `manageOrders` cannot grant itself
 * more permissions — permission checks cannot escalate privilege.
 */

router.use(authenticate, requireRole('owner', 'admin'));

router.get('/permissions', listPermissionsHandler);
router.get('/', requireShopUser, listStaffHandler);

router.post('/', validate(validateCreateStaff), createStaffHandler);
router.patch('/:userId', validate(validateUpdateStaff), updateStaffHandler);
router.delete('/:userId', deactivateStaffHandler);

export default router;
