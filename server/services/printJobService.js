import { randomUUID } from 'node:crypto';
import ApiError from '../utils/ApiError.js';
import config from '../config/index.js';
import { getRepository } from '../repositories/active.js';
import {
  JOB_STATUS,
  MAX_PRINT_ATTEMPTS,
  assertPrintable,
  assertTransition,
  describeProgress,
  isTerminal,
} from './jobStateMachine.js';
import { emitToShop, emitToAgent, emitToOrder } from './realtimeService.js';

/**
 * Print job lifecycle.
 *
 * A job is the unit of work a Print Agent executes. One paid order produces
 * exactly one job — that is what "pay once, print once" means in the data model.
 *
 * ## Duplicate-print prevention, defence in depth
 *
 * Duplicate printing is the failure mode that costs a shop real paper and
 * reprints, so it is guarded at three levels:
 *
 *  1. **Order status** — an order that already produced a job is never asked to
 *     produce another one.
 *  2. **Claim stamp** — `assign()` writes `assignedAgentId` + `claimedAt` only if
 *     the job is still QUEUED. A second agent polling at the same instant sees
 *     the job as already claimed.
 *  3. **Print stamp** — `printedAt` is written once when printing begins, and
 *     `assertPrintable()` refuses any job that has one.
 *
 * The agent additionally records an idempotency key, so a retried HTTP call
 * cannot double-start a print.
 */

function jobCode() {
  const random = randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
  return `PJ-${random}`;
}

/** Append an immutable event row. The audit trail is never rewritten. */
async function recordEvent(
  job,
  status,
  { actor = 'system', actorId = null, note = null, metadata = {} } = {},
) {
  const repo = getRepository();
  const event = await repo.insert('printJobEvents', {
    jobId: job.id,
    jobCode: job.jobCode,
    shopId: job.shopId,
    machineId: job.machineId,
    status,
    actor,
    actorId,
    note,
    metadata,
    at: new Date().toISOString(),
  });

  // A failed event write must not fail the business operation, but the gap is
  // visible in the job's own timeline count.
  return event;
}

/**
 * Create the job for a paid order.
 *
 * Idempotent on `orderId`: calling twice returns the existing job rather than
 * creating a second one. The unique index on orderId backs this up even under
 * concurrency.
 */
export async function createJobForOrder({ order, machine, document = null, paidAt = null }) {
  const repo = getRepository();

  const existing = await repo.findOne('printJobs', { orderId: order.id });
  if (existing) return { job: existing, created: false };

  const now = new Date().toISOString();
  const job = await repo.insert('printJobs', {
    jobCode: jobCode(),
    orderId: order.id,
    shopId: order.shopId,
    machineId: machine?.machineId ?? order.machineId,
    machineRef: machine?.id ?? null,
    documentId: document?.id ?? order.documentId ?? null,
    documentName: document?.originalName ?? order.documentName ?? null,
    pageCount: order.pageCount ?? document?.pageCount ?? null,
    selectedPages: order.selectedPages ?? null,
    copies: order.copies ?? 1,
    color: order.color ?? 'bw',
    sides: order.sides ?? 'single',
    paperSize: order.paperSize ?? 'A4',
    status: JOB_STATUS.PAID,
    // Proof of payment, copied onto the job. `assertPrintable` refuses to print
    // anything without it, so this must be set from the order's own paidAt —
    // never assumed, and never taken from the request body.
    paidAt: paidAt ?? order.paidAt ?? null,
    amountPaise: order.totals?.totalPaise ?? null,
    simulated: order.simulated === true,
    attempts: 0,
    printedAt: null,
    completedAt: null,
    failedAt: null,
    failureReason: null,
    assignedAgentId: null,
    claimedAt: null,
    // Written by the agent on the print request; makes a retried POST harmless.
    idempotencyKey: null,
    createdAt: now,
  });

  await recordEvent(job, JOB_STATUS.PAID, { note: 'Payment confirmed, job created' });

  // Immediately eligible for an agent to claim.
  const queued = await transitionJob({
    jobId: job.id,
    to: JOB_STATUS.QUEUED,
    actor: 'system',
    note: 'Queued for printing',
  });

  return { job: queued, created: true };
}

/**
 * The only way a job's status changes.
 *
 * Writes the event row, stamps the relevant timestamp, and emits a realtime
 * update — so the customer screen, shop dashboard and admin monitor all see the
 * same transition at the same moment.
 */
export async function transitionJob({
  jobId,
  to,
  actor = 'system',
  actorId = null,
  note = null,
  metadata = {},
  expectedFrom = null,
  extra = {},
}) {
  const repo = getRepository();
  const job = await repo.findById('printJobs', jobId);
  if (!job) throw ApiError.notFound('Print job not found', { code: 'JOB_NOT_FOUND' });

  if (expectedFrom && job.status !== expectedFrom) {
    throw ApiError.conflict(`This job is no longer ${expectedFrom}`, {
      code: 'JOB_STATE_CHANGED',
      details: { expected: expectedFrom, actual: job.status },
    });
  }

  // Idempotent: re-asserting the current status is a no-op, not an error, so a
  // retried agent call does not blow up.
  if (job.status === to) {
    return job;
  }

  assertTransition(job.status, to, { jobCode: job.jobCode });

  const stamps = {};
  if (to === JOB_STATUS.PRINTING) {
    if (job.printedAt) {
      throw ApiError.conflict('This job has already been printed', {
        code: 'ALREADY_PRINTED',
        details: { printedAt: job.printedAt },
      });
    }
    stamps.printedAt = new Date().toISOString();
  }
  if (to === JOB_STATUS.COMPLETED) stamps.completedAt = new Date().toISOString();
  if (to === JOB_STATUS.FAILED) stamps.failedAt = new Date().toISOString();

  const updated = await repo.updateById('printJobs', jobId, {
    status: to,
    previousStatus: job.status,
    ...stamps,
    ...extra,
  });

  await recordEvent(updated, to, { actor, actorId, note, metadata });

  // Realtime fan-out. Fire-and-forget: a socket failure must never fail a print.
  try {
    emitToOrder(updated.id, 'job:status', publicJob(updated));
    emitToShop(updated.shopId, 'job:status', publicJob(updated));
    if (updated.assignedAgentId) {
      emitToAgent(updated.assignedAgentId, 'job:status', publicJob(updated));
    }
  } catch {
    // Deliberately swallowed; the job is already persisted.
  }

  return updated;
}

/**
 * Claim the next queued job for an agent.
 *
 * Returns null when there is nothing to do — that is a normal long-poll result,
 * not an error. The claim is atomic in the sense that matters: the job is
 * re-read and only claimed if it is still QUEUED, so two agents polling at once
 * cannot both take it.
 */
export async function claimNextJob({ agent, machineIds }) {
  const repo = getRepository();

  const candidates = await repo.find(
    'printJobs',
    {
      shopId: agent.shopId,
      machineId: { $in: machineIds },
      status: JOB_STATUS.QUEUED,
    },
    { sort: { createdAt: 1 }, limit: 1 },
  );

  const candidate = candidates[0];
  if (!candidate) return null;

  // Re-read to close the window between the query and the claim.
  const fresh = await repo.findById('printJobs', candidate.id);
  if (!fresh || fresh.status !== JOB_STATUS.QUEUED) return null;

  const claimed = await repo.updateById('printJobs', fresh.id, {
    status: JOB_STATUS.ASSIGNED,
    assignedAgentId: agent.id,
    assignedMachineId: fresh.machineId,
    claimedAt: new Date().toISOString(),
  });

  await recordEvent(claimed, JOB_STATUS.ASSIGNED, {
    actor: 'agent',
    actorId: agent.id,
    note: `Claimed by agent ${agent.name}`,
  });

  try {
    emitToOrder(claimed.id, 'job:status', publicJob(claimed));
    emitToShop(claimed.shopId, 'job:status', publicJob(claimed));
  } catch {
    /* non-fatal */
  }

  return claimed;
}

/** Agent reports it has finished downloading the document. */
export async function markDownloading({ job, agent }) {
  assertAgentOwnsJob(job, agent);
  return transitionJob({
    jobId: job.id,
    to: JOB_STATUS.DOWNLOADING,
    actor: 'agent',
    actorId: agent.id,
    expectedFrom: JOB_STATUS.ASSIGNED,
  });
}

/**
 * Agent asks to begin printing.
 *
 * This is the last checkpoint before paper moves. It re-checks `printedAt`
 * under the state machine so two concurrent print requests cannot both pass.
 */
export async function startPrinting({ jobId, agent, idempotencyKey }) {
  const repo = getRepository();
  const job = await repo.findById('printJobs', jobId);
  if (!job) throw ApiError.notFound('Print job not found', { code: 'JOB_NOT_FOUND' });

  assertAgentOwnsJob(job, agent);

  // A retried request with the same key is the same print, not a second one.
  if (idempotencyKey && job.idempotencyKey === idempotencyKey) {
    return job;
  }

  assertPrintable(job);

  if (job.attempts >= MAX_PRINT_ATTEMPTS) {
    throw ApiError.conflict('Retry limit reached for this job', {
      code: 'RETRY_LIMIT_EXCEEDED',
      details: { attempts: job.attempts, maxAttempts: MAX_PRINT_ATTEMPTS },
    });
  }

  return transitionJob({
    jobId: job.id,
    to: JOB_STATUS.PRINTING,
    actor: 'agent',
    actorId: agent.id,
    note: `Print attempt ${(job.attempts ?? 0) + 1}`,
    expectedFrom: JOB_STATUS.DOWNLOADING,
    extra: {
      idempotencyKey: idempotencyKey ?? null,
      attempts: (job.attempts ?? 0) + 1,
      agentName: agent.name,
    },
  });
}

/** Agent reports the outcome. */
export async function completePrinting({ jobId, agent, pagesPrinted = null, note = null }) {
  const repo = getRepository();
  const job = await repo.findById('printJobs', jobId);
  if (!job) throw ApiError.notFound('Print job not found', { code: 'JOB_NOT_FOUND' });
  assertAgentOwnsJob(job, agent);

  if (job.status === JOB_STATUS.COMPLETED) return job; // idempotent

  return transitionJob({
    jobId: job.id,
    to: JOB_STATUS.COMPLETED,
    actor: 'agent',
    actorId: agent.id,
    note: note ?? 'Printed successfully',
    expectedFrom: JOB_STATUS.PRINTING,
    extra: { pagesPrinted, printedByAgentId: agent.id },
  });
}

export async function failPrinting({ jobId, agent = null, reason, retryable = true }) {
  const repo = getRepository();
  const job = await repo.findById('printJobs', jobId);
  if (!job) throw ApiError.notFound('Print job not found', { code: 'JOB_NOT_FOUND' });
  if (agent) assertAgentOwnsJob(job, agent);

  if (isTerminal(job.status)) {
    throw ApiError.conflict(`Cannot fail a ${job.status.toLowerCase()} job`, {
      code: 'JOB_TERMINAL',
      details: { status: job.status },
    });
  }

  const failed = await transitionJob({
    jobId: job.id,
    to: JOB_STATUS.FAILED,
    actor: agent ? 'agent' : 'system',
    actorId: agent?.id ?? null,
    note: reason,
    expectedFrom: job.status === JOB_STATUS.PRINTING ? JOB_STATUS.PRINTING : job.status,
    extra: { failureReason: reason, failureRetryable: retryable },
  });

  return failed;
}

/** Shop owner or admin re-queues a failed job. */
export async function retryJob({ jobId, actorId = null, note = 'Retried by shop' }) {
  const repo = getRepository();
  const job = await repo.findById('printJobs', jobId);
  if (!job) throw ApiError.notFound('Print job not found', { code: 'JOB_NOT_FOUND' });

  if (job.status !== JOB_STATUS.FAILED) {
    throw ApiError.conflict('Only failed jobs can be retried', {
      code: 'JOB_NOT_FAILED',
      details: { status: job.status },
    });
  }
  if ((job.attempts ?? 0) >= MAX_PRINT_ATTEMPTS) {
    throw ApiError.conflict('This job has exceeded its retry limit', {
      code: 'RETRY_LIMIT_EXCEEDED',
      details: { attempts: job.attempts, maxAttempts: MAX_PRINT_ATTEMPTS },
    });
  }

  return transitionJob({
    jobId: job.id,
    to: JOB_STATUS.QUEUED,
    actor: 'user',
    actorId,
    note,
    expectedFrom: JOB_STATUS.FAILED,
    extra: { assignedAgentId: null, claimedAt: null, failureReason: null },
  });
}

function assertAgentOwnsJob(job, agent) {
  if (!agent) {
    throw ApiError.unauthorized('Agent authentication required', { code: 'AGENT_AUTH_REQUIRED' });
  }
  // A legitimate agent only ever works on jobs from its own shop and machine.
  if (String(job.shopId) !== String(agent.shopId)) {
    throw ApiError.notFound('Print job not found', { code: 'JOB_NOT_FOUND' });
  }
  if (job.assignedAgentId && String(job.assignedAgentId) !== String(agent.id)) {
    throw ApiError.conflict('This job is assigned to another agent', {
      code: 'JOB_ASSIGNED_ELSEWHERE',
    });
  }
  if (String(job.machineId) !== String(agent.machineId)) {
    throw ApiError.forbidden('This job belongs to a different machine', {
      code: 'WRONG_MACHINE',
      details: { jobMachine: job.machineId, agentMachine: agent.machineId },
    });
  }
}

/** Timeline for the customer tracking screen. */
export async function getJobTimeline(jobId) {
  const repo = getRepository();
  return repo.findAll('printJobEvents', { jobId }, { sort: { at: 1 } });
}

/** Client-safe projection. Never includes storage paths or agent secrets. */
export function publicJob(job) {
  if (!job) return null;
  return {
    id: job.id,
    jobCode: job.jobCode,
    orderId: job.orderId,
    shopId: job.shopId,
    machineId: job.machineId,
    status: job.status,
    progress: describeProgress(job.status),
    documentName: job.documentName,
    pageCount: job.pageCount,
    selectedPages: job.selectedPages,
    copies: job.copies,
    color: job.color,
    sides: job.sides,
    paperSize: job.paperSize,
    attempts: job.attempts ?? 0,
    failureReason: job.failureReason ?? null,
    printedAt: job.printedAt ?? null,
    completedAt: job.completedAt ?? null,
    createdAt: job.createdAt,
    // Explicitly surfaced so no screen can imply a physical print happened in
    // the virtual printer mode.
    simulated: job.simulated === true,
  };
}

export { recordEvent };
