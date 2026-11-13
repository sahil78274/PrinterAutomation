import asyncHandler from '../utils/asyncHandler.js';
import { sendSuccess, sendCreated } from '../utils/apiResponse.js';
import ApiError from '../utils/ApiError.js';
import * as agentService from '../services/agentService.js';
import * as jobService from '../services/printJobService.js';
import { getRepository } from '../repositories/active.js';
import { readDocument } from '../services/documentService.js';
import { audit } from '../services/auditService.js';

/**
 * Print Agent API.
 *
 * The agent is an appliance: it polls, claims, downloads, prints, reports. These
 * endpoints expose exactly that loop and nothing else.
 */

/** POST /api/agents/register — admin/owner action, returns the key once. */
export const registerAgentHandler = asyncHandler(async (req, res) => {
  const shopId = req.shopScope?.shopId ?? req.auth.shopId;
  const result = await agentService.registerAgent({
    machineId: req.body.machineId,
    shopId,
    name: req.body.name,
    printMode: req.body.printMode,
    printerName: req.body.printerName,
    platform: req.body.platform,
  });

  await audit(req, {
    action: 'agent.registered',
    entity: 'printAgent',
    entityId: result.agent.agentId,
    shopId,
    metadata: { machineId: req.body.machineId, printMode: result.agent.printMode },
  });

  return sendCreated(res, result);
});

/** POST /api/agents/revoke */
export const revokeAgentHandler = asyncHandler(async (req, res) => {
  const shopId = req.shopScope?.shopId ?? req.auth.shopId;
  const result = await agentService.revokeAgent({ agentId: req.body.agentId, shopId });
  await audit(req, {
    action: 'agent.revoked',
    entity: 'printAgent',
    entityId: req.body.agentId,
    shopId,
  });
  return sendSuccess(res, result);
});

/** POST /api/agents/heartbeat — agent authenticated. */
export const heartbeatHandler = asyncHandler(async (req, res) => {
  const result = await agentService.heartbeat({
    agent: req.agent,
    status: req.body.status ?? 'online',
    version: req.body.version ?? null,
    queueDepth: req.body.queueDepth ?? null,
    printer: req.body.printer ?? null,
  });
  return sendSuccess(res, result);
});

/**
 * GET /api/agents/jobs/next — long-poll for work.
 *
 * A 204 with no body means "nothing to do", which is the normal steady state.
 * Returning 404 here would force agents to treat an error case as normal.
 */
export const claimJobHandler = asyncHandler(async (req, res) => {
  const job = await jobService.claimNextJob({
    agent: req.agent,
    machineIds: [req.agent.machineId],
  });

  if (!job) return res.status(204).end();
  return sendSuccess(res, jobService.publicJob(job));
});

/**
 * GET /api/agents/jobs/:jobId/document
 *
 * Streams the PDF for an assigned job. Authorisation is implicit in
 * `assertAgentOwnsJob`: the agent may only read documents for its own machine's
 * assigned jobs, so a leaked job id is not a leaked document.
 */
export const downloadDocumentHandler = asyncHandler(async (req, res) => {
  const repo = getRepository();
  const job = await repo.findById('printJobs', req.params.jobId);
  if (!job) throw ApiError.notFound('Print job not found', { code: 'JOB_NOT_FOUND' });

  if (String(job.shopId) !== String(req.agent.shopId)) {
    throw ApiError.notFound('Print job not found', { code: 'JOB_NOT_FOUND' });
  }
  if (String(job.machineId) !== String(req.agent.machineId)) {
    throw ApiError.forbidden('This job belongs to a different machine', { code: 'WRONG_MACHINE' });
  }
  if (job.assignedAgentId && String(job.assignedAgentId) !== String(req.agent.id)) {
    throw ApiError.conflict('This job is assigned to another agent', {
      code: 'JOB_ASSIGNED_ELSEWHERE',
    });
  }

  // Only assigned/downloading/printing jobs are downloadable. A completed job's
  // document has no reason to be readable again.
  if (['COMPLETED', 'CANCELLED'].includes(job.status)) {
    throw ApiError.conflict('This job is finished; the document is no longer available', {
      code: 'JOB_TERMINAL',
    });
  }

  const document = await repo.findById('documents', job.documentId);
  if (!document) {
    throw ApiError.notFound('The document is no longer available', { code: 'DOCUMENT_EXPIRED' });
  }

  const buffer = await readDocument(document);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Length', String(buffer.length));
  // Never inline: this is a file for a machine, not a page for a browser.
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${document.originalName.replace(/["\\]/g, '_')}"`,
  );
  res.setHeader('X-Document-Pages', String(document.pageCount));
  return res.send(buffer);
});

/** POST /api/agents/jobs/:jobId/downloading */
export const markDownloadingHandler = asyncHandler(async (req, res) => {
  const repo = getRepository();
  const job = await repo.findById('printJobs', req.params.jobId);
  if (!job) throw ApiError.notFound('Print job not found', { code: 'JOB_NOT_FOUND' });
  const updated = await jobService.markDownloading({ job, agent: req.agent });
  return sendSuccess(res, jobService.publicJob(updated));
});

/** POST /api/agents/jobs/:jobId/printing — the last checkpoint before paper moves. */
export const startPrintingHandler = asyncHandler(async (req, res) => {
  const job = await jobService.startPrinting({
    jobId: req.params.jobId,
    agent: req.agent,
    idempotencyKey: req.body.idempotencyKey ?? null,
  });
  await audit(req, {
    action: 'job.printing_started',
    entity: 'printJob',
    entityId: job.id,
    shopId: job.shopId,
    metadata: { attempts: job.attempts, printMode: req.agent.printMode },
  });
  return sendSuccess(res, jobService.publicJob(job));
});

/** POST /api/agents/jobs/:jobId/complete */
export const completeJobHandler = asyncHandler(async (req, res) => {
  const job = await jobService.completePrinting({
    jobId: req.params.jobId,
    agent: req.agent,
    pagesPrinted: req.body.pagesPrinted ?? null,
    note: req.body.note ?? null,
  });

  await audit(req, {
    action: 'job.completed',
    entity: 'printJob',
    entityId: job.id,
    shopId: job.shopId,
    metadata: { printMode: req.agent.printMode, simulated: req.agent.printMode === 'virtual' },
  });

  return sendSuccess(res, jobService.publicJob(job));
});

/** POST /api/agents/jobs/:jobId/fail */
export const failJobHandler = asyncHandler(async (req, res) => {
  const job = await jobService.failPrinting({
    jobId: req.params.jobId,
    agent: req.agent,
    reason: req.body.reason ?? 'Agent reported a failure',
    retryable: req.body.retryable !== false,
  });
  await audit(req, {
    action: 'job.failed',
    entity: 'printJob',
    entityId: job.id,
    shopId: job.shopId,
    metadata: { reason: req.body.reason },
  });
  return sendSuccess(res, jobService.publicJob(job));
});
