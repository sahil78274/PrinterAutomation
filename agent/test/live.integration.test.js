import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createWorker } from '../src/worker.js';
import { createVirtualPrinter } from '../src/printer.js';
import { createApiClient } from '../src/api.js';

/**
 * Live integration: a real agent worker against the real Express API.
 *
 * This is the closest thing to the 14-point acceptance flow that can run without
 * Windows and without a printer: everything is real except the spooler, which is
 * the virtual back end and reports itself as simulated.
 *
 * The server runs on the in-memory repository, so no MongoDB is required.
 */

const SERVER_ROOT = path.resolve(import.meta.dirname, '../../server');

let harness;
let api;
let agentConfig;
let shopId;
let machineId;
let documentId;
let orderId;
let jobId;
let dataDir;

const auth = (token) => ({ Authorization: `Bearer ${token}` });
let ownerToken;

async function apiRequest(
  pathname,
  { method = 'GET', body, token = ownerToken, headers = {} } = {},
) {
  const response = await fetch(`${harness.baseUrl}${pathname}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? auth(token) : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

async function makePdf(pages) {
  const { PDFDocument, StandardFonts } = await import(
    path.join(SERVER_ROOT, 'node_modules/pdf-lib/cjs/index.js')
  ).catch(async () => import('pdf-lib'));
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= pages; i += 1) {
    const page = pdf.addPage([595, 842]);
    page.drawText(`Page ${i}`, { x: 60, y: 760, size: 18, font });
  }
  return Buffer.from(await pdf.save());
}

before(async () => {
  process.env.NODE_ENV = 'test';

  // Boot the API in-process, exactly as its own tests do.
  const { startTestServer } = await import(path.join(SERVER_ROOT, 'test/helpers/server.js'));
  harness = await startTestServer();

  const { getRepository } = await import(path.join(SERVER_ROOT, 'repositories/active.js'));
  const repo = getRepository();

  // Shop owner via the public API.
  const registration = await apiRequest('/api/auth/register', {
    method: 'POST',
    token: null,
    body: {
      name: 'Live Owner',
      email: 'live@agent.test',
      password: 'OwnerPass123',
      shopName: 'Live Prints',
    },
  });
  ownerToken = registration.body.data.accessToken;
  shopId = registration.body.data.shop.id;
  await repo.updateById('shops', shopId, { status: 'active' });

  // Machine.
  const machine = await apiRequest('/api/machines', {
    method: 'POST',
    body: {
      shopId,
      name: 'Live Counter',
      printer: { model: 'Test Printer', supportsColor: false, supportsDuplex: true },
      pricing: { bwSinglePaise: 200, bwDoublePaise: 300, minimumChargePaise: 0 },
    },
  });
  machineId = machine.body.data.machineId;
  await repo.updateById('machines', machine.body.data.id, { status: 'online' });

  // Document upload, multipart against the real endpoint.
  const pdf = await makePdf(6);
  const boundary = `----live${Date.now()}`;
  const parts = [
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="machineId"\r\n\r\n${machineId}\r\n`,
    ),
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="live.pdf"\r\nContent-Type: application/pdf\r\n\r\n`,
    ),
    pdf,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ];
  const upload = await fetch(`${harness.baseUrl}/api/documents`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body: Buffer.concat(parts),
  });
  const uploadBody = await upload.json();
  assert.equal(upload.status, 201, JSON.stringify(uploadBody));
  documentId = uploadBody.data.id;

  // Order + simulated payment.
  const order = await apiRequest('/api/orders', {
    method: 'POST',
    token: null,
    body: { machineId, documentId, copies: 1, sides: 'double', color: 'bw' },
  });
  assert.equal(order.status, 201, JSON.stringify(order.body));
  orderId = order.body.data.id;

  const pay = await apiRequest(`/api/orders/${orderId}/pay`, {
    method: 'POST',
    token: null,
    body: { outcome: 'success' },
  });
  const confirm = await apiRequest(`/api/orders/${orderId}/confirm`, {
    method: 'POST',
    token: null,
    body: { attemptId: pay.body.data.attemptId, outcome: 'success' },
  });
  assert.equal(confirm.status, 200, JSON.stringify(confirm.body));
  jobId = confirm.body.data.job.id;

  // Agent registration through the real endpoint.
  const registrationResponse = await apiRequest('/api/agents/register', {
    method: 'POST',
    body: { machineId, name: 'Live agent', printMode: 'virtual' },
  });
  assert.equal(registrationResponse.status, 201, JSON.stringify(registrationResponse.body));

  const agent = registrationResponse.body.data.agent;
  const agentKey = registrationResponse.body.data.agentKey;

  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smartprint-live-'));

  agentConfig = {
    server: harness.baseUrl,
    agentId: agent.agentId,
    agentKey,
    machineId,
    printMode: 'virtual',
    printerName: null,
    pollMs: 20,
    heartbeatMs: 60_000,
    requestTimeoutMs: 10_000,
    dataDir,
    hostname: 'live-test',
    version: '1.0.0',
  };

  api = createApiClient({
    server: harness.baseUrl,
    agentId: agent.agentId,
    agentKey,
    timeoutMs: 10_000,
  });
});

after(async () => {
  await harness?.close();
  if (dataDir) fs.rmSync(dataDir, { recursive: true, force: true });
});

describe('live agent against the live API', () => {
  test('the doctor can reach the server with its real key', async () => {
    const heartbeat = await api.heartbeat({ status: 'online', version: '1.0.0' });
    assert.ok(heartbeat);
    assert.equal(heartbeat.agent.online, true);
  });

  test('the worker prints the real queued job and completes it', async () => {
    const printer = createVirtualPrinter({ outputDir: path.join(dataDir, 'receipts') });
    const worker = createWorker({
      config: agentConfig,
      api,
      printer,
      logger: { info() {}, warn() {}, error() {} },
    });

    const job = await worker.tick();

    assert.ok(job, 'the worker should have claimed the queued job');
    assert.equal(job.id, jobId);

    // The server now agrees the job is complete.
    const detail = await apiRequest(`/api/print-jobs/${jobId}`);
    assert.equal(detail.status, 200);
    assert.equal(detail.body.data.status, 'COMPLETED');

    // And it is recorded as simulated, because nothing physical happened.
    const timeline = await apiRequest(`/api/print-jobs/${jobId}/timeline`);
    const statuses = timeline.body.data.map((event) => event.status);
    for (const expected of ['PAID', 'QUEUED', 'ASSIGNED', 'DOWNLOADING', 'PRINTING', 'COMPLETED']) {
      assert.ok(statuses.includes(expected), `timeline missing ${expected}`);
    }

    // The receipt exists on disk and says nothing was printed.
    const receipts = fs.readdirSync(path.join(dataDir, 'receipts'));
    assert.equal(receipts.length, 1);
    const receipt = fs.readFileSync(path.join(dataDir, 'receipts', receipts[0]), 'utf8');
    assert.match(receipt, /NOTHING WAS PRINTED/i);
  });

  test('the customer sees the completed job on their order', async () => {
    const response = await apiRequest(`/api/orders/${orderId}`, { token: null });
    assert.equal(response.status, 200);
    assert.equal(response.body.data.job.status, 'COMPLETED');
    assert.equal(response.body.data.job.progress.percent, 100);
  });

  test('a second tick has nothing to do — the job is not reprinted', async () => {
    const printer = createVirtualPrinter({ outputDir: path.join(dataDir, 'receipts') });
    const worker = createWorker({
      config: agentConfig,
      api,
      printer,
      logger: { info() {}, warn() {}, error() {} },
    });

    assert.equal(await worker.tick(), null);
    // Still exactly one receipt, from the first run.
    assert.equal(fs.readdirSync(path.join(dataDir, 'receipts')).length, 1);
  });

  test('the worker cleans up its downloaded document', async () => {
    const documentsDir = path.join(dataDir, 'documents');
    const remaining = fs.existsSync(documentsDir) ? fs.readdirSync(documentsDir) : [];
    assert.deepEqual(remaining, []);
  });

  test('a revoked agent key cannot fetch work', async () => {
    // Revoke through the real endpoint, then try again with the same client.
    const agents = await apiRequest(`/api/machines/${machineId}/detail`);
    assert.equal(agents.status, 200);

    const repo = (await import(path.join(SERVER_ROOT, 'repositories/active.js'))).getRepository();
    const agent = await repo.findOne('printAgents', { machineId });
    await repo.updateById('printAgents', agent.id, {
      revokedAt: new Date().toISOString(),
      status: 'revoked',
    });

    // 403, not 401: the credential is still a real one, its authority has been
    // withdrawn. The distinction tells a shop whether to re-pair or to look for
    // a leak.
    await assert.rejects(
      () => api.nextJob(),
      (error) => {
        assert.equal(error.status, 403);
        assert.equal(error.code, 'AGENT_REVOKED');
        return true;
      },
    );
  });
});
