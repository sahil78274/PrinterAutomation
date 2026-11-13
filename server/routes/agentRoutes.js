import { Router } from 'express';
import {
  registerAgentHandler,
  revokeAgentHandler,
  heartbeatHandler,
  claimJobHandler,
  downloadDocumentHandler,
  markDownloadingHandler,
  startPrintingHandler,
  completeJobHandler,
  failJobHandler,
} from '../controllers/agentController.js';
import requireAgent from '../middleware/agentAuth.js';
import { authenticate, requireAdmin, requireShopUser } from '../middleware/auth.js';
import { agentLimiter } from '../middleware/rateLimiters.js';
import validate from '../middleware/validate.js';
import {
  validateAgentRegistration,
  validateAgentRevoke,
  validateHeartbeat,
  validatePrintStart,
  validateJobFailure,
} from '../validators/agentValidator.js';

const router = Router();

/**
 * Print Agent API.
 *
 * Two very different callers share this namespace:
 *
 *   - Humans (owner/admin) *manage* agents: register, revoke.
 *   - Agents *use* the API: heartbeat, claim, download, report.
 *
 * They use different credentials and are mounted separately here so a mistake in
 * one can never open the other.
 */

// --- Human management (JWT) ------------------------------------------------
router.post(
  '/register',
  authenticate,
  requireShopUser,
  validate(validateAgentRegistration),
  registerAgentHandler,
);
router.post(
  '/revoke',
  authenticate,
  requireShopUser,
  validate(validateAgentRevoke),
  revokeAgentHandler,
);

// --- Agent operations (agent key) ------------------------------------------
router.post(
  '/heartbeat',
  agentLimiter,
  requireAgent,
  validate(validateHeartbeat),
  heartbeatHandler,
);
router.get('/jobs/next', agentLimiter, requireAgent, claimJobHandler);
router.get('/jobs/:jobId/document', agentLimiter, requireAgent, downloadDocumentHandler);
router.post('/jobs/:jobId/downloading', agentLimiter, requireAgent, markDownloadingHandler);
router.post(
  '/jobs/:jobId/printing',
  agentLimiter,
  requireAgent,
  validate(validatePrintStart),
  startPrintingHandler,
);
router.post('/jobs/:jobId/complete', agentLimiter, requireAgent, completeJobHandler);
router.post(
  '/jobs/:jobId/fail',
  agentLimiter,
  requireAgent,
  validate(validateJobFailure),
  failJobHandler,
);

/** Admin-only overview of every agent on the platform. */
router.get('/all', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { getRepository } = await import('../repositories/active.js');
    const { publicAgent } = await import('../services/agentService.js');
    const agents = await getRepository().findAll('printAgents', {});
    res.json({ success: true, data: agents.map(publicAgent) });
  } catch (error) {
    next(error);
  }
});

export default router;
