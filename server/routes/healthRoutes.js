import { Router } from 'express';
import { getHealth, getHealthDetails, getReadiness } from '../controllers/healthController.js';

const router = Router();

/**
 * Health endpoints are intentionally outside the global rate limiter's stricter
 * bucket and never require a database, so probes behave predictably.
 */
router.get('/', getHealth);
router.get('/ready', getReadiness);
router.get('/details', getHealthDetails);

export default router;
