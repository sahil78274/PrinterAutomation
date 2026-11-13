import { Router } from 'express';
import {
  createShopHandler,
  getShopHandler,
  listShopsHandler,
} from '../controllers/shopController.js';
import validate from '../middleware/validate.js';
import requireDatabase from '../middleware/requireDatabase.js';
import devOnlyAdmin from '../middleware/devOnly.js';
import { validateCreateShop } from '../validators/shopValidator.js';

const router = Router();

/**
 * All shop routes are tenant-admin operations. They sit behind devOnlyAdmin
 * until Phase 3 replaces it with JWT + role checks.
 */
// Guard first (404 for unauthorised), then validate input, then require the DB.
router.use(devOnlyAdmin);

router.post('/', validate(validateCreateShop), requireDatabase, createShopHandler);
router.use(requireDatabase);
router.get('/', listShopsHandler);
router.get('/:identifier', getShopHandler);

export default router;
