import asyncHandler from '../utils/asyncHandler.js';
import { authenticateAgent } from '../services/agentService.js';

/**
 * Authenticate a Print Agent from `X-Agent-Id` / `X-Agent-Key`.
 *
 * Separate from user authentication on purpose: agents are machines, not people,
 * and must never be able to act as a user even if their key leaks into the wrong
 * hands. A leaked agent key can only do what an agent may do — claim its own
 * machine's jobs and report progress.
 */
const requireAgent = asyncHandler(async (req, res, next) => {
  const agent = await authenticateAgent(req.headers);
  req.agent = agent;
  next();
});

export default requireAgent;
