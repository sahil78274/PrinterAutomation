import { Router } from 'express';
import {
  cancelJobHandler,
  getJobHandler,
  getTimelineHandler,
  listJobsHandler,
  retryJobHandler,
} from '../controllers/printJobController.js';
import { authenticate, requireShopUser, resolveShopScope } from '../middleware/auth.js';

const router = Router();

/**
 * Print-job inspection and recovery for shop staff.
 *
 * This is NOT the agent API. Agents authenticate with a machine key against
 * /api/agents/*; nothing here can advance a job into PRINTING.
 */

router.use(authenticate, requireShopUser, resolveShopScope);

router.get('/', listJobsHandler);
router.get('/:jobId', getJobHandler);
router.get('/:jobId/timeline', getTimelineHandler);
router.post('/:jobId/retry', retryJobHandler);
router.post('/:jobId/cancel', cancelJobHandler);

export default router;
