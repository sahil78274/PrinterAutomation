import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

/**
 * The agent's work loop.
 *
 * One job at a time, always. The loop is written so that a crash at any point
 * leaves the system in a state the server can recover from:
 *
 *   - the claim is atomic on the server, so two agents cannot get one job;
 *   - an in-flight job is written to `inflight.json` before printing starts, and
 *     reported as failed on the next start rather than forgotten;
 *   - the print call carries an idempotency key, so a retried request cannot
 *     produce a second sheet.
 */

export const INFLIGHT_FILENAME = 'inflight.json';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function writeInflight(dataDir, record) {
  fs.mkdirSync(dataDir, { recursive: true });
  const file = path.join(dataDir, INFLIGHT_FILENAME);
  fs.writeFileSync(file, JSON.stringify(record, null, 2), { mode: 0o600 });
  return file;
}

function readInflight(dataDir) {
  const file = path.join(dataDir, INFLIGHT_FILENAME);
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function clearInflight(dataDir) {
  const file = path.join(dataDir, INFLIGHT_FILENAME);
  try {
    fs.unlinkSync(file);
  } catch {
    // Already gone is the desired state.
  }
}

/** Download to a private temp file. 0600 so other users cannot read a customer's document. */
function saveDocument(dataDir, job, bytes) {
  const dir = path.join(dataDir, 'documents');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${job.id}.pdf`);
  fs.writeFileSync(file, bytes, { mode: 0o600 });
  return file;
}

function removeDocument(file) {
  try {
    fs.unlinkSync(file);
  } catch {
    // The document is gone either way; a leftover file is cleaner but not fatal.
  }
}

/** A PDF must start with %PDF-; anything else is not safe to hand a spooler. */
export function looksLikePdf(bytes) {
  return Buffer.isBuffer(bytes) && bytes.length > 4 && bytes.subarray(0, 5).toString() === '%PDF-';
}

export function createWorker({ config, api, printer, logger = console, clock = () => Date.now() }) {
  const state = {
    running: false,
    stopping: false,
    jobsPrinted: 0,
    jobsFailed: 0,
    consecutiveErrors: 0,
    lastHeartbeatAt: null,
    currentJobId: null,
  };

  /**
   * Report an interrupted job from a previous run.
   *
   * Called before the loop starts. Without this, a power cut mid-print would
   * leave a job stuck in DOWNLOADING for ever and the customer waiting.
   */
  async function recoverInterruptedJob() {
    const record = readInflight(config.dataDir);
    if (!record?.jobId) return;

    try {
      await api.failJob(record.jobId, {
        reason: 'The print agent restarted while this job was in progress',
        recoverable: true,
      });
      logger.warn?.(`[agent] reported interrupted job ${record.jobCode ?? record.jobId} as failed`);
    } catch (error) {
      logger.error?.(`[agent] could not report interrupted job: ${error.message}`);
    } finally {
      clearInflight(config.dataDir);
    }
  }

  async function sendHeartbeat() {
    try {
      const description = await printer.describe().catch(() => ({}));
      await api.heartbeat({
        status: 'online',
        version: config.version,
        hostname: config.hostname,
        printMode: printer.mode,
        printerName: description.printerName ?? null,
        printerAvailable: description.available ?? null,
        queueDepth: 0,
      });
      state.lastHeartbeatAt = clock();
      return true;
    } catch (error) {
      // A failed heartbeat is not fatal: the job poll will surface the problem.
      logger.warn?.(`[agent] heartbeat failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Run one job end to end.
   *
   * The order of operations is the safety property:
   *   claim → download → validate → mark downloading → ask to print →
   *   print → report success
   *
   * The print call happens only after the server has recorded the intent, so a
   * crash between "ask" and "print" leaves a job the server can safely retry.
   */
  async function runJob(job) {
    const idempotencyKey = crypto.createHash('sha256').update(`${job.id}:${clock()}`).digest('hex');
    let documentPath = null;

    state.currentJobId = job.id;
    writeInflight(config.dataDir, {
      jobId: job.id,
      jobCode: job.jobCode,
      startedAt: new Date(clock()).toISOString(),
    });

    try {
      const document = await api.downloadDocument(job.id);
      if (!document?.bytes?.length) {
        throw new Error('The server returned an empty document');
      }
      if (!looksLikePdf(document.bytes)) {
        // Refuse to hand a non-PDF to the spooler. The server already validated
        // it at upload; this is defence in depth against a corrupt transfer.
        throw new Error('The downloaded document is not a valid PDF');
      }

      documentPath = saveDocument(config.dataDir, job, document.bytes);
      await api.markDownloading(job.id);

      // Ask the server to authorise this print. The server writes printedAt
      // once; a second request with a different key is refused.
      await api.startPrinting(job.id, { idempotencyKey });

      const result = await printer.print(documentPath, {
        copies: job.copies ?? 1,
        job,
      });

      await api.completeJob(job.id, {
        pagesPrinted: (job.pageCount ?? 0) * (job.copies ?? 1),
        printerName: result.printerName,
        simulated: result.simulated,
        note: result.simulated
          ? 'Virtual printer mode — nothing was physically printed'
          : 'Sent to the printer spooler',
      });

      state.jobsPrinted += 1;
      logger.info?.(
        `[agent] ${job.jobCode ?? job.id} ${result.simulated ? 'simulated' : 'printed'} on ${result.printerName}`,
      );
      return true;
    } catch (error) {
      state.jobsFailed += 1;
      logger.error?.(`[agent] job ${job.jobCode ?? job.id} failed: ${error.message}`);

      try {
        await api.failJob(job.id, {
          reason: error.message,
          // A printer problem is worth retrying; a rejected document is not.
          recoverable: printerErrorIsRecoverable(error),
        });
      } catch (reportError) {
        // If even the failure report fails, inflight.json stays behind and the
        // next start will report it. That is the intended fallback.
        logger.error?.(`[agent] could not report failure: ${reportError.message}`);
        return false;
      }

      clearInflight(config.dataDir);
      return false;
    } finally {
      if (documentPath) removeDocument(documentPath);
      state.currentJobId = null;
    }
  }

  /** One pass: heartbeat if due, then try to claim exactly one job. */
  async function tick() {
    if (state.lastHeartbeatAt === null || clock() - state.lastHeartbeatAt >= config.heartbeatMs) {
      await sendHeartbeat();
    }

    const job = await api.nextJob();
    if (!job) return null;

    await runJob(job);
    return job;
  }

  /**
   * Start the loop.
   *
   * Errors back off exponentially to a 60 second ceiling so a server outage
   * does not turn into a request flood, and reset on the first success.
   */
  async function start() {
    state.running = true;
    state.stopping = false;

    await recoverInterruptedJob();
    await sendHeartbeat();

    const description = await printer.describe();
    logger.info?.(
      `[agent] ready — mode=${description.mode}${description.simulated ? ' (SIMULATED)' : ''} printer=${description.printerName ?? 'none'}`,
    );
    if (description.mode === 'real' && !description.available) {
      logger.warn?.(
        '[agent] no printer detected. Install a printer in Windows or set SMARTPRINT_PRINTER.',
      );
    }

    while (!state.stopping) {
      try {
        await tick();
        state.consecutiveErrors = 0;
        // Stay responsive after a job; idle politely when there is nothing.
        await sleep(config.pollMs);
      } catch (error) {
        state.consecutiveErrors += 1;
        // 3s, 6s, 12s, 24s, 48s, 60s, 60s...
        const backoff = Math.min(60_000, config.pollMs * 2 ** state.consecutiveErrors);
        logger.warn?.(
          `[agent] poll failed (${error.code ?? 'ERROR'}: ${error.message}); retrying in ${Math.round(backoff / 1000)}s`,
        );
        await sleep(backoff);
      }
    }

    state.running = false;
    logger.info?.('[agent] stopped');
  }

  async function stop() {
    state.stopping = true;
    // Wait for the in-flight job to finish rather than pulling the plug on a print.
    const deadline = clock() + 30_000;
    while (state.currentJobId && clock() < deadline) {
      await sleep(200);
    }
  }

  return {
    start,
    stop,
    tick,
    runJob,
    sendHeartbeat,
    state,
    readInflight: () => readInflight(config.dataDir),
  };
}

/** Is this failure worth the server's retry budget? */
export function printerErrorIsRecoverable(error) {
  const message = String(error?.message ?? '').toLowerCase();
  if (error?.code === 'NETWORK_ERROR' || error?.code === 'TIMEOUT') return true;
  // Transient printer conditions.
  if (/offline|paper|jam|busy|spooler|timeout|not found/.test(message)) return true;
  if (/not a valid pdf|empty document|rejected/.test(message)) return false;
  return true;
}

export default createWorker;
