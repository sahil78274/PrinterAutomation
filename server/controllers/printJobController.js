import asyncHandler from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import ApiError from '../utils/ApiError.js';
import { getRepository } from '../repositories/active.js';
import { publicJob, getJobTimeline, retryJob, transitionJob } from '../services/printJobService.js';
import { JOB_STATUS, describeProgress } from '../services/jobStateMachine.js';
import { audit } from '../services/auditService.js';

/**
 * Print job inspection for shop staff and admins.
 *
 * Staff can see and recover jobs in their own shop. The one write they have is
 * retry, because a jammed printer is a counter problem that should not need an
 * engineer. Nothing here can force a job into PRINTING — that path belongs to
 * the authenticated agent alone.
 */

function scopeFilter(req) {
  if (req.auth?.role === 'admin') {
    return req.query.shopId ? { shopId: req.query.shopId } : {};
  }
  if (!req.auth?.shopId) {
    throw ApiError.forbidden('This account is not attached to a shop', { code: 'NO_SHOP' });
  }
  return { shopId: req.auth.shopId };
}

/** GET /api/print-jobs */
export const listJobsHandler = asyncHandler(async (req, res) => {
  const repo = getRepository();
  const filter = scopeFilter(req);

  if (req.query.status) filter.status = String(req.query.status).toUpperCase();
  if (req.query.machineId) filter.machineId = req.query.machineId;

  const [jobs, total] = await Promise.all([
    repo.find('printJobs', filter, {
      page: req.query.page,
      limit: req.query.limit,
      sort: { createdAt: -1 },
    }),
    repo.count('printJobs', filter),
  ]);

  return sendSuccess(res, jobs.map(publicJob), {
    meta: { total, page: Number(req.query.page ?? 1), limit: Number(req.query.limit ?? 20) },
  });
});

/** GET /api/print-jobs/:jobId */
export const getJobHandler = asyncHandler(async (req, res) => {
  const repo = getRepository();
  const filter = { ...scopeFilter(req), id: req.params.jobId };

  const job = await repo.findOne('printJobs', filter);
  if (!job) throw ApiError.notFound('Print job not found', { code: 'JOB_NOT_FOUND' });

  const timeline = await getJobTimeline(job.id);

  return sendSuccess(res, {
    ...publicJob(job),
    progress: describeProgress(job.status),
    timeline,
  });
});

/**
 * POST /api/print-jobs/:jobId/retry
 *
 * Only a FAILED job can be retried, and only while attempts remain. The retry
 * limit is enforced by the service, not here.
 */
export const retryJobHandler = asyncHandler(async (req, res) => {
  const repo = getRepository();
  const filter = { ...scopeFilter(req), id: req.params.jobId };

  const job = await repo.findOne('printJobs', filter);
  if (!job) throw ApiError.notFound('Print job not found', { code: 'JOB_NOT_FOUND' });

  const updated = await retryJob({
    jobId: job.id,
    actorId: req.auth?.userId ?? null,
    note: `Retried by ${req.auth?.role ?? 'staff'}`,
  });

  await audit(req, {
    action: 'job.retried',
    entity: 'printJob',
    entityId: updated.id,
    shopId: updated.shopId,
    metadata: { attempts: updated.attempts },
  });

  return sendSuccess(res, publicJob(updated));
});

/**
 * POST /api/print-jobs/:jobId/cancel
 *
 * Staff may cancel a job that has not started printing. Once paper is moving,
 * cancellation is refused — the state machine disallows it.
 */
export const cancelJobHandler = asyncHandler(async (req, res) => {
  const repo = getRepository();
  const filter = { ...scopeFilter(req), id: req.params.jobId };

  const job = await repo.findOne('printJobs', filter);
  if (!job) throw ApiError.notFound('Print job not found', { code: 'JOB_NOT_FOUND' });

  const updated = await transitionJob({
    jobId: job.id,
    to: JOB_STATUS.CANCELLED,
    actor: req.auth?.userId ?? 'staff',
    note: req.body?.reason ?? 'Cancelled by staff',
  });

  await audit(req, {
    action: 'job.cancelled',
    entity: 'printJob',
    entityId: updated.id,
    shopId: updated.shopId,
  });

  return sendSuccess(res, publicJob(updated));
});

/** GET /api/print-jobs/:jobId/timeline */
export const getTimelineHandler = asyncHandler(async (req, res) => {
  const repo = getRepository();
  const filter = { ...scopeFilter(req), id: req.params.jobId };

  const job = await repo.findOne('printJobs', filter);
  if (!job) throw ApiError.notFound('Print job not found', { code: 'JOB_NOT_FOUND' });

  return sendSuccess(res, await getJobTimeline(job.id));
});
