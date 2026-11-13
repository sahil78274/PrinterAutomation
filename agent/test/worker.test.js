import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createWorker, looksLikePdf, printerErrorIsRecoverable } from '../src/worker.js';
import { createVirtualPrinter, createPrinter, createRealPrinter } from '../src/printer.js';
import {
  loadConfig,
  assertRunnable,
  writeConfigFile,
  readConfigFile,
  PRINT_MODES,
} from '../src/config.js';
import { createApiClient, AgentApiError } from '../src/api.js';

/**
 * Agent tests.
 *
 * The API and the printer are faked, because the point of these tests is the
 * *agent's* decisions: what it does with a corrupt document, a printer error, a
 * crash mid-job, and a server that is down. Those are the paths that decide
 * whether a customer is charged for a page that never printed.
 */

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'smartprint-agent-'));
}

const PDF_BYTES = Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n');

/** A recording fake of the API client. */
function fakeApi({ job = null, document = PDF_BYTES, failAt = null } = {}) {
  const calls = [];
  const maybeFail = (name) => {
    if (failAt === name) throw new AgentApiError(`simulated ${name} failure`, { status: 500 });
  };

  return {
    calls,
    server: 'http://test',
    async heartbeat(payload) {
      calls.push(['heartbeat', payload]);
      return { agent: { online: true } };
    },
    async nextJob() {
      calls.push(['nextJob']);
      maybeFail('nextJob');
      const claimed = job;
      // Only hand the job out once, like the real atomic claim.
      job = null;
      return claimed;
    },
    async downloadDocument(jobId) {
      calls.push(['downloadDocument', jobId]);
      maybeFail('downloadDocument');
      return { bytes: document, contentType: 'application/pdf' };
    },
    async markDownloading(jobId) {
      calls.push(['markDownloading', jobId]);
      return { status: 'DOWNLOADING' };
    },
    async startPrinting(jobId, { idempotencyKey }) {
      calls.push(['startPrinting', jobId, idempotencyKey]);
      maybeFail('startPrinting');
      return { status: 'PRINTING' };
    },
    async completeJob(jobId, payload) {
      calls.push(['completeJob', jobId, payload]);
      return { status: 'COMPLETED' };
    },
    async failJob(jobId, payload) {
      calls.push(['failJob', jobId, payload]);
      return { status: 'FAILED' };
    },
  };
}

const SAMPLE_JOB = {
  id: 'job-1',
  jobCode: 'PJ-0001',
  orderId: 'order-1',
  documentName: 'notes.pdf',
  pageCount: 4,
  copies: 2,
};

function makeConfig(dir, overrides = {}) {
  return {
    server: 'http://test',
    agentId: 'AG-test',
    agentKey: 'key-test',
    machineId: 'SP-001',
    printMode: 'virtual',
    printerName: null,
    pollMs: 10,
    heartbeatMs: 60_000,
    requestTimeoutMs: 5_000,
    dataDir: dir,
    hostname: 'test-host',
    version: '1.0.0',
    ...overrides,
  };
}

const silent = { info() {}, warn() {}, error() {} };

describe('document validation', () => {
  test('accepts a real PDF header', () => {
    assert.equal(looksLikePdf(PDF_BYTES), true);
  });

  test('rejects anything that is not a PDF', () => {
    assert.equal(looksLikePdf(Buffer.from('MZ\x90\x00executable')), false);
    assert.equal(looksLikePdf(Buffer.from('<html>')), false);
    assert.equal(looksLikePdf(Buffer.alloc(0)), false);
    assert.equal(looksLikePdf(null), false);
  });
});

describe('worker: happy path', () => {
  test('claims, downloads, prints and completes a job', async () => {
    const dir = tempDir();
    const api = fakeApi({ job: { ...SAMPLE_JOB } });
    const printer = createVirtualPrinter({ outputDir: path.join(dir, 'receipts') });
    const worker = createWorker({ config: makeConfig(dir), api, printer, logger: silent });

    const job = await worker.tick();

    assert.equal(job.id, 'job-1');

    // The order of API calls is the safety property.
    const names = api.calls.map((call) => call[0]);
    assert.deepEqual(names, [
      'heartbeat',
      'nextJob',
      'downloadDocument',
      'markDownloading',
      'startPrinting',
      'completeJob',
    ]);

    const complete = api.calls.at(-1);
    assert.equal(complete[1], 'job-1');
    assert.equal(complete[2].simulated, true, 'virtual output must be reported as simulated');
    // 4 pages x 2 copies
    assert.equal(complete[2].pagesPrinted, 8);

    assert.equal(worker.state.jobsPrinted, 1);
    assert.equal(worker.state.jobsFailed, 0);
  });

  test('passes an idempotency key so a retried print cannot duplicate', async () => {
    const dir = tempDir();
    const api = fakeApi({ job: { ...SAMPLE_JOB } });
    const worker = createWorker({
      config: makeConfig(dir),
      api,
      printer: createVirtualPrinter({ outputDir: dir }),
      logger: silent,
    });

    await worker.tick();

    const startPrinting = api.calls.find((call) => call[0] === 'startPrinting');
    assert.ok(startPrinting[2], 'an idempotency key is required');
    assert.equal(startPrinting[2].length, 64, 'key should be a sha256 hex digest');
  });

  test('the downloaded document is deleted after printing', async () => {
    const dir = tempDir();
    const api = fakeApi({ job: { ...SAMPLE_JOB } });
    const worker = createWorker({
      config: makeConfig(dir),
      api,
      printer: createVirtualPrinter({ outputDir: dir }),
      logger: silent,
    });

    await worker.tick();

    const documentsDir = path.join(dir, 'documents');
    const remaining = fs.existsSync(documentsDir) ? fs.readdirSync(documentsDir) : [];
    assert.deepEqual(remaining, [], 'a customer document must not be left on disk');
  });

  test('an idle poll reports nothing rather than failing', async () => {
    const dir = tempDir();
    const api = fakeApi({ job: null });
    const worker = createWorker({
      config: makeConfig(dir),
      api,
      printer: createVirtualPrinter({ outputDir: dir }),
      logger: silent,
    });

    assert.equal(await worker.tick(), null);
    assert.equal(worker.state.jobsFailed, 0);
  });
});

describe('worker: refusing bad work', () => {
  test('a non-PDF download is refused without ever reaching the printer', async () => {
    const dir = tempDir();
    const api = fakeApi({
      job: { ...SAMPLE_JOB },
      document: Buffer.from('MZ\x90\x00 definitely not a pdf'),
    });

    let printed = false;
    const printer = {
      mode: 'virtual',
      simulated: true,
      describe: async () => ({ available: true }),
      print: async () => {
        printed = true;
        return {};
      },
    };

    const worker = createWorker({ config: makeConfig(dir), api, printer, logger: silent });
    await worker.tick();

    assert.equal(printed, false, 'a corrupt document must never be printed');
    const failed = api.calls.find((call) => call[0] === 'failJob');
    assert.ok(failed, 'the failure must be reported');
    assert.match(failed[2].reason, /not a valid PDF/i);
    // Not worth retrying: the document itself is bad.
    assert.equal(failed[2].recoverable, false);
  });

  test('an empty document is refused', async () => {
    const dir = tempDir();
    const api = fakeApi({ job: { ...SAMPLE_JOB }, document: Buffer.alloc(0) });
    const worker = createWorker({
      config: makeConfig(dir),
      api,
      printer: createVirtualPrinter({ outputDir: dir }),
      logger: silent,
    });

    await worker.tick();

    const failed = api.calls.find((call) => call[0] === 'failJob');
    assert.ok(failed);
    assert.match(failed[2].reason, /empty/i);
  });

  test('a printer error is reported as retryable', async () => {
    const dir = tempDir();
    const api = fakeApi({ job: { ...SAMPLE_JOB } });
    const printer = {
      mode: 'real',
      simulated: false,
      describe: async () => ({ available: true }),
      print: async () => {
        throw new Error('Printer is offline');
      },
    };

    const worker = createWorker({ config: makeConfig(dir), api, printer, logger: silent });
    await worker.tick();

    const failed = api.calls.find((call) => call[0] === 'failJob');
    assert.ok(failed);
    assert.equal(failed[2].recoverable, true, 'a jam is worth retrying');
    assert.match(failed[2].reason, /offline/i);

    // Crucially, the job was never marked complete.
    assert.equal(
      api.calls.some((call) => call[0] === 'completeJob'),
      false,
    );
  });

  test('fails to print if the server never authorises the print', async () => {
    const dir = tempDir();
    const api = fakeApi({ job: { ...SAMPLE_JOB }, failAt: 'startPrinting' });
    let printed = false;
    const printer = {
      mode: 'virtual',
      simulated: true,
      describe: async () => ({ available: true }),
      print: async () => {
        printed = true;
        return {};
      },
    };

    const worker = createWorker({ config: makeConfig(dir), api, printer, logger: silent });
    await worker.tick();

    assert.equal(printed, false, 'nothing may print without server authorisation');
  });
});

describe('worker: crash recovery', () => {
  test('an interrupted job is reported as failed on the next start', async () => {
    const dir = tempDir();
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'inflight.json'),
      JSON.stringify({ jobId: 'job-crashed', jobCode: 'PJ-9999' }),
    );

    const api = fakeApi({ job: null });
    const worker = createWorker({
      config: makeConfig(dir),
      api,
      printer: createVirtualPrinter({ outputDir: dir }),
      logger: silent,
    });

    // start() recovers, then loops forever; drive one iteration instead.
    const recover = worker.state;
    assert.ok(recover);

    // Directly exercise recovery by calling start with an immediate stop.
    const promise = worker.start();
    await new Promise((resolve) => setTimeout(resolve, 30));
    await worker.stop();
    await promise;

    const failed = api.calls.find((call) => call[0] === 'failJob');
    assert.ok(failed, 'the interrupted job must be reported');
    assert.equal(failed[1], 'job-crashed');
    assert.equal(failed[2].recoverable, true);

    // The marker file is cleared so it cannot be reported twice.
    assert.equal(fs.existsSync(path.join(dir, 'inflight.json')), false);
  });
});

describe('printer back ends', () => {
  test('virtual printing is always marked simulated', async () => {
    const dir = tempDir();
    const printer = createVirtualPrinter({ outputDir: dir });

    const description = await printer.describe();
    assert.equal(description.mode, 'virtual');
    assert.equal(description.simulated, true);

    const file = path.join(dir, 'doc.pdf');
    fs.writeFileSync(file, PDF_BYTES);

    const result = await printer.print(file, { copies: 1, job: SAMPLE_JOB });
    assert.equal(result.simulated, true);
    assert.ok(fs.existsSync(result.receiptPath));

    const receipt = fs.readFileSync(result.receiptPath, 'utf8');
    // The receipt must say, unambiguously, that nothing was printed.
    assert.match(receipt, /NOTHING WAS PRINTED/i);
    assert.match(receipt, /PJ-0001/);
  });

  test('virtual printing refuses a missing file rather than pretending', async () => {
    const dir = tempDir();
    const printer = createVirtualPrinter({ outputDir: dir });
    await assert.rejects(
      () => printer.print(path.join(dir, 'nope.pdf'), { copies: 1 }),
      /missing from disk/,
    );
  });

  test('real printing refuses to run off Windows instead of failing obscurely', async () => {
    if (process.platform === 'win32') return; // The guard is Windows-specific.
    const printer = createRealPrinter();
    await assert.rejects(() => printer.describe(), /requires Windows/i);
  });

  test('an unknown print mode is a hard error, never a silent virtual fallback', () => {
    assert.throws(() => createPrinter({ printMode: 'ghost' }), /Unknown print mode/);
  });
});

describe('printerErrorIsRecoverable', () => {
  test('retries transient hardware conditions', () => {
    for (const message of ['Printer is offline', 'Paper jam', 'Spooler not running', 'busy']) {
      assert.equal(printerErrorIsRecoverable(new Error(message)), true, message);
    }
  });

  test('does not retry a rejected document', () => {
    assert.equal(printerErrorIsRecoverable(new Error('The document is not a valid PDF')), false);
  });

  test('retries a network failure', () => {
    const error = new AgentApiError('offline', { code: 'NETWORK_ERROR' });
    assert.equal(printerErrorIsRecoverable(error), true);
  });
});

describe('configuration', () => {
  test('defaults to real printing, not simulation', () => {
    const dir = tempDir();
    const file = path.join(dir, 'agent.config.json');
    const previous = process.env.SMARTPRINT_PRINT_MODE;
    delete process.env.SMARTPRINT_PRINT_MODE;

    try {
      const config = loadConfig({ file });
      assert.equal(config.printMode, 'real', 'simulating a paid print must never be the default');
      assert.ok(PRINT_MODES.includes(config.printMode));
    } finally {
      if (previous !== undefined) process.env.SMARTPRINT_PRINT_MODE = previous;
    }
  });

  test('an environment variable overrides the config file', () => {
    const dir = tempDir();
    const file = path.join(dir, 'agent.config.json');
    writeConfigFile({ server: 'http://from-file', printMode: 'real' }, file);

    process.env.SMARTPRINT_SERVER = 'http://from-env';
    try {
      const config = loadConfig({ file });
      assert.equal(config.server, 'http://from-env');
    } finally {
      delete process.env.SMARTPRINT_SERVER;
    }
  });

  test('the config file is written with owner-only permissions', () => {
    const dir = tempDir();
    const file = path.join(dir, 'agent.config.json');
    writeConfigFile({ agentKey: 'secret-key' }, file);

    if (process.platform !== 'win32') {
      const mode = fs.statSync(file).mode & 0o777;
      assert.equal(mode, 0o600, 'the agent key must not be world-readable');
    }
    assert.equal(readConfigFile(file).agentKey, 'secret-key');
  });

  test('an unregistered agent is refused with an actionable message', () => {
    const dir = tempDir();
    const config = makeConfig(dir, { agentId: null, agentKey: null });
    assert.throws(() => assertRunnable(config), /not registered.*register/i);
  });

  test('a corrupt config file is loud, not silently ignored', () => {
    const dir = tempDir();
    const file = path.join(dir, 'agent.config.json');
    fs.writeFileSync(file, '{not json');
    assert.throws(() => loadConfig({ file }), /Could not read/);
  });
});

describe('api client', () => {
  test('sends the agent key in headers, never the URL', async () => {
    let seen = null;
    const api = createApiClient({
      server: 'http://test',
      agentId: 'AG-1',
      agentKey: 'super-secret',
      fetchImpl: async (url, options) => {
        seen = { url, headers: options.headers };
        return new Response(JSON.stringify({ success: true, data: { ok: true } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      },
    });

    await api.heartbeat({ status: 'online' });

    assert.equal(seen.headers['X-Agent-Id'], 'AG-1');
    assert.equal(seen.headers['X-Agent-Key'], 'super-secret');
    assert.equal(seen.url.includes('super-secret'), false, 'key must not appear in the URL');
  });

  test('treats 204 as "no work", not an error', async () => {
    const api = createApiClient({
      server: 'http://test',
      agentId: 'AG-1',
      agentKey: 'k',
      fetchImpl: async () => new Response(null, { status: 204 }),
    });
    assert.equal(await api.nextJob(), null);
  });

  test('a 401 is not retryable, a 500 is', async () => {
    const make = (status) =>
      createApiClient({
        server: 'http://test',
        agentId: 'AG-1',
        agentKey: 'k',
        fetchImpl: async () =>
          new Response(JSON.stringify({ error: { message: 'nope', code: 'X' } }), {
            status,
            headers: { 'Content-Type': 'application/json' },
          }),
      });

    await assert.rejects(
      () => make(401).nextJob(),
      (error) => error.retryable === false,
    );
    await assert.rejects(
      () => make(500).nextJob(),
      (error) => error.retryable === true,
    );
  });

  test('unwraps the API envelope', async () => {
    const api = createApiClient({
      server: 'http://test',
      agentId: 'AG-1',
      agentKey: 'k',
      fetchImpl: async () =>
        new Response(JSON.stringify({ success: true, data: { id: 'job-9' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    });
    const job = await api.nextJob();
    assert.equal(job.id, 'job-9');
  });
});
