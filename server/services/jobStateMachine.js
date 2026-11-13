import ApiError from '../utils/ApiError.js';

/**
 * Print job state machine.
 *
 * The single most important rule in the product: **a paid job must be printed
 * exactly once**. That means the allowed transitions are a whitelist, not a
 * suggestion, and every write goes through `transition()`.
 *
 * ```
 *  CREATED ──> AWAITING_PAYMENT ──> PAID ──> QUEUED ──> ASSIGNED
 *     │              │               │                     │
 *     └──────────────┴───────────────┴──> CANCELLED        v
 *                                              DOWNLOADING ──> PRINTING ──> COMPLETED
 *                                                   │              │
 *                                                   └──────────────┴──> FAILED ──> (retry) QUEUED
 * ```
 *
 * Notable rules:
 *  - Only `PAID` may enter the queue. There is no path from CREATED or
 *    AWAITING_PAYMENT to QUEUED, so an unpaid job cannot be printed.
 *  - `COMPLETED` and `CANCELLED` are terminal.
 *  - `FAILED` is not terminal: a retry returns the job to QUEUED, but the
 *    attempt counter caps how many times.
 *  - Printing may only begin after the document has been fully downloaded, so a
 *    half-transfer never reaches a printer.
 */

export const JOB_STATUS = Object.freeze({
  CREATED: 'CREATED',
  AWAITING_PAYMENT: 'AWAITING_PAYMENT',
  PAID: 'PAID',
  QUEUED: 'QUEUED',
  ASSIGNED: 'ASSIGNED',
  DOWNLOADING: 'DOWNLOADING',
  PRINTING: 'PRINTING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
});

export const ALL_STATUSES = Object.values(JOB_STATUS);

/**
 * Allowed transitions. Anything absent from this map is rejected, including
 * no-op "transitions" to the same status (those are separately idempotent).
 */
export const TRANSITIONS = Object.freeze({
  [JOB_STATUS.CREATED]: [JOB_STATUS.AWAITING_PAYMENT, JOB_STATUS.CANCELLED],
  [JOB_STATUS.AWAITING_PAYMENT]: [JOB_STATUS.PAID, JOB_STATUS.CANCELLED],
  [JOB_STATUS.PAID]: [JOB_STATUS.QUEUED, JOB_STATUS.CANCELLED],
  [JOB_STATUS.QUEUED]: [JOB_STATUS.ASSIGNED, JOB_STATUS.CANCELLED],
  [JOB_STATUS.ASSIGNED]: [JOB_STATUS.DOWNLOADING, JOB_STATUS.FAILED, JOB_STATUS.CANCELLED],
  [JOB_STATUS.DOWNLOADING]: [JOB_STATUS.PRINTING, JOB_STATUS.FAILED],
  [JOB_STATUS.PRINTING]: [JOB_STATUS.COMPLETED, JOB_STATUS.FAILED],
  [JOB_STATUS.COMPLETED]: [],
  [JOB_STATUS.FAILED]: [JOB_STATUS.QUEUED, JOB_STATUS.CANCELLED],
  [JOB_STATUS.CANCELLED]: [],
});

/** Statuses in which a job still holds a claim on a printer. */
export const ACTIVE_STATUSES = Object.freeze([
  JOB_STATUS.PAID,
  JOB_STATUS.QUEUED,
  JOB_STATUS.ASSIGNED,
  JOB_STATUS.DOWNLOADING,
  JOB_STATUS.PRINTING,
]);

/** Statuses that must never be re-queued or printed again. */
export const TERMINAL_STATUSES = Object.freeze([JOB_STATUS.COMPLETED, JOB_STATUS.CANCELLED]);

export const MAX_PRINT_ATTEMPTS = 3;

export function canTransition(from, to) {
  if (!from || !to) return false;
  if (from === to) return true; // idempotent re-assert
  return (TRANSITIONS[from] ?? []).includes(to);
}

export function isTerminal(status) {
  return TERMINAL_STATUSES.includes(status);
}

export function isActive(status) {
  return ACTIVE_STATUSES.includes(status);
}

/**
 * Assert a transition is legal, or throw.
 *
 * The error is a 409 rather than a 400: the request was well-formed, but the
 * resource is not in a state that allows it. That distinction tells a client
 * "refresh and try again later" instead of "your request was wrong".
 */
export function assertTransition(from, to, { jobCode } = {}) {
  if (canTransition(from, to)) return true;

  const allowed = TRANSITIONS[from] ?? [];
  throw ApiError.conflict(`Cannot move a print job from ${from} to ${to}`, {
    code: 'INVALID_JOB_TRANSITION',
    details: {
      from,
      to,
      allowed,
      ...(jobCode ? { jobCode } : {}),
    },
  });
}

/**
 * Business-level guard for starting a print.
 *
 * Separate from the state machine because these are invariants about the job's
 * content, not about which status may follow which.
 */
export function assertPrintable(job) {
  if (!job) throw ApiError.notFound('Print job not found', { code: 'JOB_NOT_FOUND' });

  if (job.printedAt) {
    // The strongest duplicate-print defence there is: a timestamp written once.
    throw ApiError.conflict('This job has already been printed', {
      code: 'ALREADY_PRINTED',
      details: { printedAt: job.printedAt },
    });
  }

  if (isTerminal(job.status)) {
    throw ApiError.conflict(`This job is ${job.status.toLowerCase()} and cannot be printed`, {
      code: 'JOB_TERMINAL',
      details: { status: job.status },
    });
  }

  if ((job.attempts ?? 0) >= MAX_PRINT_ATTEMPTS) {
    throw ApiError.conflict('This job has exceeded its retry limit', {
      code: 'RETRY_LIMIT_EXCEEDED',
      details: { attempts: job.attempts, maxAttempts: MAX_PRINT_ATTEMPTS },
    });
  }

  if (!job.paidAt) {
    throw ApiError.conflict('This job has not been paid for', { code: 'JOB_UNPAID' });
  }

  return true;
}

/** Human-readable progress, for the customer tracking screen. */
export function describeProgress(status) {
  const stage = {
    [JOB_STATUS.CREATED]: { step: 0, label: 'Preparing your document', percent: 5 },
    [JOB_STATUS.AWAITING_PAYMENT]: { step: 1, label: 'Waiting for payment', percent: 15 },
    [JOB_STATUS.PAID]: { step: 2, label: 'Payment received', percent: 30 },
    [JOB_STATUS.QUEUED]: { step: 3, label: 'Queued for printing', percent: 45 },
    [JOB_STATUS.ASSIGNED]: { step: 4, label: 'Sent to the printer', percent: 60 },
    [JOB_STATUS.DOWNLOADING]: { step: 5, label: 'Downloading your document', percent: 70 },
    [JOB_STATUS.PRINTING]: { step: 6, label: 'Printing now', percent: 85 },
    [JOB_STATUS.COMPLETED]: { step: 7, label: 'Ready to collect', percent: 100 },
    [JOB_STATUS.FAILED]: { step: 6, label: 'Printing failed', percent: 85 },
    [JOB_STATUS.CANCELLED]: { step: 0, label: 'Cancelled', percent: 0 },
  }[status];

  return stage ?? { step: 0, label: 'Unknown', percent: 0 };
}
