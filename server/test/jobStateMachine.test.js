import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  JOB_STATUS,
  TRANSITIONS,
  ACTIVE_STATUSES,
  TERMINAL_STATUSES,
  MAX_PRINT_ATTEMPTS,
  canTransition,
  assertTransition,
  assertPrintable,
  describeProgress,
} from '../services/jobStateMachine.js';

/**
 * Capture the error a function throws.
 *
 * `assert.throws` returns undefined in Node, so the thrown error is caught here
 * to let each test assert on its status, code and details.
 */
function captureError(fn) {
  try {
    fn();
  } catch (error) {
    return error;
  }
  assert.fail('Expected the call to throw, but it returned normally');
}

/**
 * The print-job state machine is the safety core of the product: it is what
 * stands between a customer's payment and a physical sheet of paper. A bug here
 * prints twice and costs the shop money, so every invariant is pinned by a test.
 */

describe('job state machine: the whitelist', () => {
  test('there are exactly ten states, all distinct', () => {
    const states = Object.values(JOB_STATUS);
    assert.equal(states.length, 10);
    assert.equal(new Set(states).size, 10);
  });

  test('every state appears in the transition table', () => {
    for (const state of Object.values(JOB_STATUS)) {
      assert.ok(TRANSITIONS[state], `${state} is missing from TRANSITIONS`);
    }
  });

  test('every target state is a real state', () => {
    for (const [from, targets] of Object.entries(TRANSITIONS)) {
      for (const to of targets) {
        assert.ok(
          Object.values(JOB_STATUS).includes(to),
          `${from} transitions to unknown state ${to}`,
        );
      }
    }
  });

  test('only a paid or retried job may join the print queue', () => {
    const statesLeadingToQueued = Object.entries(TRANSITIONS)
      .filter(([, targets]) => targets.includes(JOB_STATUS.QUEUED))
      .map(([from]) => from)
      .sort();

    assert.deepEqual(statesLeadingToQueued, [JOB_STATUS.FAILED, JOB_STATUS.PAID]);
  });

  test('terminal states go nowhere', () => {
    for (const terminal of TERMINAL_STATUSES) {
      assert.deepEqual(TRANSITIONS[terminal], [], `${terminal} must be terminal`);
    }
  });

  test('printing can only begin from DOWNLOADING', () => {
    const sources = Object.entries(TRANSITIONS)
      .filter(([, targets]) => targets.includes(JOB_STATUS.PRINTING))
      .map(([from]) => from)
      .sort();
    assert.deepEqual(sources, [JOB_STATUS.DOWNLOADING]);
  });

  test('active and terminal status sets do not overlap', () => {
    const overlap = ACTIVE_STATUSES.filter((status) => TERMINAL_STATUSES.includes(status));
    assert.deepEqual(overlap, []);
  });

  test('MAX_PRINT_ATTEMPTS is a small, safe number', () => {
    // A retry loop that runs away is worse than a failed job: it reams paper.
    assert.ok(MAX_PRINT_ATTEMPTS >= 2 && MAX_PRINT_ATTEMPTS <= 5);
  });
});

describe('canTransition', () => {
  test('allows the happy path', () => {
    const path = [
      JOB_STATUS.PAID,
      JOB_STATUS.QUEUED,
      JOB_STATUS.ASSIGNED,
      JOB_STATUS.DOWNLOADING,
      JOB_STATUS.PRINTING,
      JOB_STATUS.COMPLETED,
    ];

    for (let i = 0; i < path.length - 1; i += 1) {
      assert.equal(canTransition(path[i], path[i + 1]), true, `${path[i]} -> ${path[i + 1]}`);
    }
  });

  test('rejects skipping payment', () => {
    assert.equal(canTransition(JOB_STATUS.CREATED, JOB_STATUS.QUEUED), false);
    assert.equal(canTransition(JOB_STATUS.ASSIGNED, JOB_STATUS.PRINTING), false);
  });

  test('rejects resurrecting a completed job', () => {
    assert.equal(canTransition(JOB_STATUS.COMPLETED, JOB_STATUS.QUEUED), false);
    assert.equal(canTransition(JOB_STATUS.COMPLETED, JOB_STATUS.PRINTING), false);
  });

  test('rejects cancelling after printing has started', () => {
    assert.equal(canTransition(JOB_STATUS.PRINTING, JOB_STATUS.CANCELLED), false);
  });

  test('rejects unknown states in either position', () => {
    assert.equal(canTransition('NOPE', JOB_STATUS.QUEUED), false);
    assert.equal(canTransition(JOB_STATUS.QUEUED, 'NOPE'), false);
    assert.equal(canTransition(undefined, undefined), false);
  });

  test('allows a failed job to be retried', () => {
    assert.equal(canTransition(JOB_STATUS.FAILED, JOB_STATUS.QUEUED), true);
  });
});

describe('assertTransition', () => {
  test('throws a 409 for an illegal move, naming both states', () => {
    const error = captureError(() => assertTransition(JOB_STATUS.COMPLETED, JOB_STATUS.QUEUED));
    assert.equal(error.statusCode, 409);
    assert.equal(error.code, 'INVALID_JOB_TRANSITION');
    assert.equal(error.details.from, JOB_STATUS.COMPLETED);
    assert.equal(error.details.to, JOB_STATUS.QUEUED);
    assert.deepEqual(error.details.allowed, []);
  });

  test('the error lists what would have been allowed instead', () => {
    const error = captureError(() => assertTransition(JOB_STATUS.QUEUED, JOB_STATUS.COMPLETED));
    // Telling the agent the legal next steps is what makes a stuck job debuggable.
    assert.ok(Array.isArray(error.details.allowed));
    assert.ok(error.details.allowed.includes(JOB_STATUS.ASSIGNED));
  });

  test('mentions the job code when one is supplied', () => {
    const error = captureError(() =>
      assertTransition(JOB_STATUS.CANCELLED, JOB_STATUS.QUEUED, { jobCode: 'PJ-0001' }),
    );
    assert.equal(error.details.jobCode, 'PJ-0001');
  });

  test('returns true for a legal move', () => {
    assert.equal(assertTransition(JOB_STATUS.QUEUED, JOB_STATUS.ASSIGNED), true);
  });

  test('a failed job may rejoin the queue at the transition level', () => {
    // Attempt counting lives in assertPrintable and retryJob, not here: the
    // transition table describes shape, the attempt limit describes budget.
    assert.equal(assertTransition(JOB_STATUS.FAILED, JOB_STATUS.QUEUED), true);
  });
});

describe('assertPrintable: the last line of defence', () => {
  test('accepts a paid, printed-once, in-attempt job', () => {
    assert.equal(
      assertPrintable({
        status: JOB_STATUS.DOWNLOADING,
        paidAt: '2026-01-01T00:00:00.000Z',
        printedAt: null,
        attempts: 0,
      }),
      true,
    );
  });

  test('refuses an unpaid job', () => {
    const error = captureError(() =>
      assertPrintable({ status: JOB_STATUS.QUEUED, paidAt: null, printedAt: null, attempts: 0 }),
    );
    assert.equal(error.code, 'JOB_UNPAID');
    assert.equal(error.statusCode, 409);
  });

  test('refuses a job that has already printed — write-once printedAt', () => {
    const error = captureError(() =>
      assertPrintable({
        status: JOB_STATUS.PRINTING,
        paidAt: '2026-01-01T00:00:00.000Z',
        printedAt: '2026-01-01T00:05:00.000Z',
        attempts: 1,
      }),
    );
    assert.equal(error.code, 'ALREADY_PRINTED');
    // The duplicate-print guard fires even when the status still looks printable.
    assert.ok(error.details.printedAt);
  });

  test('refuses past the attempt limit', () => {
    const error = captureError(() =>
      assertPrintable({
        status: JOB_STATUS.QUEUED,
        paidAt: '2026-01-01T00:00:00.000Z',
        printedAt: null,
        attempts: MAX_PRINT_ATTEMPTS,
      }),
    );
    assert.equal(error.code, 'RETRY_LIMIT_EXCEEDED');
    assert.equal(error.details.maxAttempts, MAX_PRINT_ATTEMPTS);
  });

  test('refuses a terminal job even when it was paid', () => {
    const error = captureError(() =>
      assertPrintable({
        status: JOB_STATUS.CANCELLED,
        paidAt: '2026-01-01T00:00:00.000Z',
        printedAt: null,
        attempts: 0,
      }),
    );
    assert.equal(error.code, 'JOB_TERMINAL');
  });

  test('a missing job is a 404, not a crash', () => {
    const error = captureError(() => assertPrintable(null));
    assert.equal(error.statusCode, 404);
    assert.equal(error.code, 'JOB_NOT_FOUND');
  });
});

describe('describeProgress', () => {
  test('reports a partial percentage when the job is only paid', () => {
    const progress = describeProgress(JOB_STATUS.PAID);
    assert.ok(progress.percent > 0 && progress.percent < 100, `got ${progress.percent}`);
    assert.ok(progress.label.length > 0);
  });

  test('reports 100% for a finished job', () => {
    const progress = describeProgress(JOB_STATUS.COMPLETED);
    assert.equal(progress.percent, 100);
    assert.equal(progress.step, 7);
  });

  test('progress never decreases and stays within 0-100 along the happy path', () => {
    const path = [
      JOB_STATUS.PAID,
      JOB_STATUS.QUEUED,
      JOB_STATUS.ASSIGNED,
      JOB_STATUS.DOWNLOADING,
      JOB_STATUS.PRINTING,
      JOB_STATUS.COMPLETED,
    ];

    let previous = -1;
    for (const status of path) {
      const { percent } = describeProgress(status);
      assert.ok(percent >= previous, `${status} went backwards (${percent} < ${previous})`);
      assert.ok(percent >= 0 && percent <= 100, `${status} produced ${percent}%`);
      previous = percent;
    }
  });

  test('every state has a label a customer can read', () => {
    for (const status of Object.values(JOB_STATUS)) {
      const { label, percent } = describeProgress(status);
      assert.equal(typeof label, 'string');
      assert.ok(label.length > 3, `${status} has no useful label`);
      // No raw enum names leaking into the customer-facing tracking screen.
      assert.notEqual(label, status);
      assert.equal(label, label.replace(/_/g, ''), `${status} leaks an enum-style label`);
      assert.ok(percent >= 0 && percent <= 100);
    }
  });

  test('a failure is described as a failure', () => {
    const progress = describeProgress(JOB_STATUS.FAILED);
    assert.ok(/fail/i.test(progress.label), `unhelpful label: ${progress.label}`);
  });

  test('an unknown status degrades safely instead of throwing', () => {
    const progress = describeProgress('SOMETHING_NEW');
    assert.equal(progress.percent, 0);
    assert.equal(typeof progress.label, 'string');
  });
});
