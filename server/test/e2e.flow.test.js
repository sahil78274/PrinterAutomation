import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { startTestServer, request } from './helpers/server.js';
import { getRepository } from '../repositories/active.js';

/**
 * End-to-end: QR scan → upload → price → simulated payment → print job →
 * Print Agent claim → virtual print → completion.
 *
 * This is the acceptance test for the product. It exercises the real HTTP
 * surface and the real services; only the database adapter is in-memory.
 *
 * Test environment: the API runs on the memory repository and the development
 * payment provider. Nothing here touches MongoDB, a printer or a payment gateway.
 */

let harness;
let admin;
let owner;
let shop;
let machine;

/** Build a real multi-page PDF so page counting is genuinely exercised. */
async function makePdf(pageCount) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= pageCount; i += 1) {
    const page = pdf.addPage([595, 842]);
    page.drawText(`SmartPrint test page ${i}`, { x: 60, y: 760, size: 18, font });
  }
  return Buffer.from(await pdf.save());
}

/** Minimal multipart/form-data body, since we are not using a browser. */
function multipart(fields, file) {
  const boundary = `----smartprint${Date.now()}${Math.random().toString(16).slice(2)}`;
  const parts = [];

  for (const [name, value] of Object.entries(fields)) {
    parts.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
      ),
    );
  }

  parts.push(
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${file.name}"\r\n` +
        `Content-Type: ${file.type}\r\n\r\n`,
    ),
  );
  parts.push(file.buffer);
  parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

  return { body: Buffer.concat(parts), contentType: `multipart/form-data; boundary=${boundary}` };
}

/** Raw request for multipart, since the shared helper sends JSON. */
async function upload(baseUrl, fields, file, headers = {}) {
  const { body, contentType } = multipart(fields, file);
  const response = await fetch(`${baseUrl}/api/documents`, {
    method: 'POST',
    headers: { 'Content-Type': contentType, ...headers },
    body,
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

const auth = (token) => ({ Authorization: `Bearer ${token}` });

before(async () => {
  process.env.NODE_ENV = 'test';
  harness = await startTestServer();

  // Admin is created out-of-band, as a seed script would.
  const { createAdmin } = await import('../services/authService.js');
  const created = await createAdmin({
    name: 'Platform Admin',
    email: 'admin@smartprint.test',
    password: 'AdminPass123',
  });
  admin = created.user;

  // A shop owner registers through the public API.
  const registration = await request(harness.baseUrl, '/api/auth/register', {
    method: 'POST',
    body: {
      name: 'Priya Owner',
      email: 'priya@shop.test',
      password: 'OwnerPass123',
      shopName: 'Priya Prints',
    },
  });
  owner = { token: registration.body.data.accessToken, ...registration.body.data.user };
  shop = registration.body.data.shop;

  // Approve the shop so it can trade.
  await getRepository().updateById('shops', shop.id, { status: 'active' });

  // Register a machine on that shop.
  const machineResponse = await request(harness.baseUrl, '/api/machines', {
    method: 'POST',
    headers: auth(owner.token),
    body: {
      shopId: shop.id,
      name: 'Counter A',
      printer: { model: 'HP LaserJet M404dn', supportsColor: false, supportsDuplex: true },
      pricing: { bwSinglePaise: 200, bwDoublePaise: 300, minimumChargePaise: 0 },
    },
  });
  machine = machineResponse.body.data;
  await getRepository().updateById('machines', machine.id, { status: 'online' });
});

after(async () => {
  await harness?.close();
});

describe('end-to-end: customer prints a document', () => {
  let document;
  let order;
  let job;
  let agent;
  let agentKey;

  test('1. the machine QR resolves publicly', async () => {
    const response = await request(harness.baseUrl, `/api/machines/${machine.machineId}`);
    assert.equal(response.status, 200);
    assert.equal(response.body.data.machineId, machine.machineId);
    assert.equal(response.body.data.qrPath, `/print/${machine.machineId}`);
  });

  test('2. a real PDF uploads and its pages are counted server-side', async () => {
    const pdf = await makePdf(8);
    const result = await upload(
      harness.baseUrl,
      { machineId: machine.machineId },
      {
        name: 'notes.pdf',
        type: 'application/pdf',
        buffer: pdf,
      },
    );

    assert.equal(result.status, 201, JSON.stringify(result.body));
    document = result.body.data;
    // The page count comes from parsing the file, not from the client.
    assert.equal(document.pageCount, 8);
    assert.equal(document.originalName, 'notes.pdf');
    assert.ok(document.sizeBytes > 0);
  });

  test('3. a non-PDF renamed to .pdf is rejected on its bytes', async () => {
    const result = await upload(
      harness.baseUrl,
      { machineId: machine.machineId },
      {
        name: 'malware.pdf',
        type: 'application/pdf',
        buffer: Buffer.from('MZ\x90\x00 this is an executable, not a pdf'),
      },
    );
    assert.equal(result.status, 422);
    assert.equal(result.body.error.code, 'UNSUPPORTED_FILE_TYPE');
  });

  test('4. the server prices the order and ignores any client-supplied total', async () => {
    const response = await request(harness.baseUrl, '/api/orders', {
      method: 'POST',
      body: {
        machineId: machine.machineId,
        documentId: document.id,
        copies: 2,
        color: 'bw',
        sides: 'double',
        paperSize: 'A4',
        // An attempt to pay ₹1 for the job:
        totalPaise: 100,
        totals: { totalPaise: 100 },
      },
    });

    assert.equal(response.status, 201, JSON.stringify(response.body));
    order = response.body.data;

    // 8 pages duplex, 2 copies = 4 duplex sheets x 2 copies = 8 sheets @ ₹3 = ₹24
    assert.equal(order.totals.subtotalPaise, 2400);
    // ...plus the platform fee (default 6%), which the server adds itself.
    assert.equal(order.totals.platformFeePaise, Math.round((2400 * 600) / 10_000));
    assert.equal(
      order.totals.totalPaise,
      order.totals.subtotalPaise + order.totals.platformFeePaise,
    );

    // The decisive assertion: the ₹1 total the client tried to inject is gone.
    assert.notEqual(order.totals.totalPaise, 100);
    assert.ok(order.totals.totalPaise >= order.totals.subtotalPaise);
    assert.equal(order.status, 'awaiting_payment');
  });

  test('5. the order is not printable before payment', async () => {
    const response = await request(harness.baseUrl, `/api/orders/${order.id}`);
    assert.equal(response.body.data.job, null);
    assert.equal(response.body.data.order.status, 'awaiting_payment');
  });

  test('6. a simulated payment authorizes exactly one print job', async () => {
    const pay = await request(harness.baseUrl, `/api/orders/${order.id}/pay`, {
      method: 'POST',
      body: { outcome: 'success' },
    });
    assert.equal(pay.status, 200);
    assert.equal(pay.body.data.intent.simulated, true, 'payment must be flagged simulated');

    const confirm = await request(harness.baseUrl, `/api/orders/${order.id}/confirm`, {
      method: 'POST',
      body: { attemptId: pay.body.data.attemptId, outcome: 'success' },
    });
    assert.equal(confirm.status, 200, JSON.stringify(confirm.body));
    assert.equal(confirm.body.data.order.status, 'paid');
    assert.equal(confirm.body.data.authorized, true);
    assert.equal(confirm.body.data.job.status, 'QUEUED');
    job = confirm.body.data.job;
  });

  test('7. confirming again does not create a second job', async () => {
    const before = await getRepository().count('printJobs', { orderId: order.id });
    const again = await request(harness.baseUrl, `/api/orders/${order.id}/confirm`, {
      method: 'POST',
      body: { outcome: 'success' },
    });
    const after = await getRepository().count('printJobs', { orderId: order.id });

    assert.equal(again.status, 200);
    assert.equal(again.body.data.alreadyPaid, true);
    assert.equal(again.body.data.authorized, false);
    assert.equal(after, before, 'a repeated confirmation must not queue a second print');
  });

  test('8. a Print Agent registers and receives its key exactly once', async () => {
    const response = await request(harness.baseUrl, '/api/agents/register', {
      method: 'POST',
      headers: auth(owner.token),
      body: { machineId: machine.machineId, name: 'Priya counter agent', printMode: 'virtual' },
    });

    assert.equal(response.status, 201, JSON.stringify(response.body));
    agent = response.body.data.agent;
    agentKey = response.body.data.agentKey;
    assert.ok(agentKey.length >= 32);
    assert.equal(agent.agentId.startsWith('AG-'), true);
    // The key is never echoed back by any read endpoint.
    assert.equal(agent.agentKey, undefined);
    assert.equal(agent.agentKeyHash, undefined);
  });

  test('9. a wrong agent key is rejected', async () => {
    const response = await request(harness.baseUrl, '/api/agents/heartbeat', {
      method: 'POST',
      headers: { 'X-Agent-Id': agent.agentId, 'X-Agent-Key': 'wrong-key' },
      body: { status: 'online' },
    });
    assert.equal(response.status, 401);
    assert.equal(response.body.error.code, 'AGENT_UNAUTHORIZED');
  });

  test('10. the agent heartbeats and the machine appears online', async () => {
    const response = await request(harness.baseUrl, '/api/agents/heartbeat', {
      method: 'POST',
      headers: { 'X-Agent-Id': agent.agentId, 'X-Agent-Key': agentKey },
      body: { status: 'online', version: '1.0.0-test', queueDepth: 0 },
    });

    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal(response.body.data.agent.online, true);

    const machineRow = await getRepository().findById('machines', machine.id);
    assert.equal(machineRow.status, 'online');
  });

  test('11. the agent claims the queued job', async () => {
    const response = await request(harness.baseUrl, '/api/agents/jobs/next', {
      headers: { 'X-Agent-Id': agent.agentId, 'X-Agent-Key': agentKey },
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.data.id, job.id);
    assert.equal(response.body.data.status, 'ASSIGNED');
  });

  test('12. a second poll finds nothing rather than double-claiming', async () => {
    const response = await request(harness.baseUrl, '/api/agents/jobs/next', {
      headers: { 'X-Agent-Id': agent.agentId, 'X-Agent-Key': agentKey },
    });
    assert.equal(response.status, 204, 'no work should return 204, not an error');
  });

  test('13. the agent downloads the authorised document', async () => {
    const response = await fetch(`${harness.baseUrl}/api/agents/jobs/${job.id}/document`, {
      headers: { 'X-Agent-Id': agent.agentId, 'X-Agent-Key': agentKey },
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'application/pdf');

    const bytes = Buffer.from(await response.arrayBuffer());
    assert.equal(bytes.subarray(0, 5).toString(), '%PDF-', 'download must be the real PDF');
  });

  test('14. the job walks DOWNLOADING -> PRINTING', async () => {
    const headers = { 'X-Agent-Id': agent.agentId, 'X-Agent-Key': agentKey };

    const downloading = await request(harness.baseUrl, `/api/agents/jobs/${job.id}/downloading`, {
      method: 'POST',
      headers,
    });
    assert.equal(downloading.body.data.status, 'DOWNLOADING');

    const printing = await request(harness.baseUrl, `/api/agents/jobs/${job.id}/printing`, {
      method: 'POST',
      headers,
      body: { idempotencyKey: 'print-once-123' },
    });
    assert.equal(printing.status, 200, JSON.stringify(printing.body));
    assert.equal(printing.body.data.status, 'PRINTING');
  });

  test('15. a retried print request with the same key does not print twice', async () => {
    const headers = { 'X-Agent-Id': agent.agentId, 'X-Agent-Key': agentKey };
    const attemptBefore = (await getRepository().findById('printJobs', job.id)).attempts;

    const retry = await request(harness.baseUrl, `/api/agents/jobs/${job.id}/printing`, {
      method: 'POST',
      headers,
      body: { idempotencyKey: 'print-once-123' },
    });

    const attemptAfter = (await getRepository().findById('printJobs', job.id)).attempts;
    assert.equal(retry.status, 200);
    assert.equal(
      attemptAfter,
      attemptBefore,
      'a repeated idempotency key must not increment attempts',
    );
  });

  test('16. a different print request on a printed job is refused', async () => {
    const headers = { 'X-Agent-Id': agent.agentId, 'X-Agent-Key': agentKey };
    const response = await request(harness.baseUrl, `/api/agents/jobs/${job.id}/printing`, {
      method: 'POST',
      headers,
      body: { idempotencyKey: 'a-different-attempt' },
    });
    // The job is already printing; a second print is a conflict, never a new sheet.
    assert.ok([409].includes(response.status), `expected 409, got ${response.status}`);
  });

  test('17. virtual printer mode completes the job and flags it as simulated', async () => {
    const response = await request(harness.baseUrl, `/api/agents/jobs/${job.id}/complete`, {
      method: 'POST',
      headers: { 'X-Agent-Id': agent.agentId, 'X-Agent-Key': agentKey },
      body: { pagesPrinted: 16, note: 'Virtual print complete' },
    });

    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal(response.body.data.status, 'COMPLETED');
    assert.equal(response.body.data.simulated, true, 'virtual output must be marked simulated');
  });

  test('18. the customer sees the full timeline', async () => {
    const response = await request(harness.baseUrl, `/api/orders/${order.id}`);
    const { order: tracked, job: trackedJob, timeline } = response.body.data;

    assert.equal(tracked.status, 'paid');
    assert.equal(trackedJob.status, 'COMPLETED');
    assert.equal(trackedJob.progress.percent, 100);

    const statuses = timeline.map((event) => event.status);
    for (const expected of ['PAID', 'QUEUED', 'ASSIGNED', 'DOWNLOADING', 'PRINTING', 'COMPLETED']) {
      assert.ok(statuses.includes(expected), `timeline missing ${expected}`);
    }
  });

  test('19. the document is deleted from disk after completion, metadata retained', async () => {
    const { deleteDocument } = await import('../services/documentService.js');
    await deleteDocument(document.id, { reason: 'completed' });

    const row = await getRepository().findById('documents', document.id, { includeDeleted: true });
    assert.ok(row.deletedAt, 'document should be soft-deleted');
    // Accounting still works because the order kept the metadata.
    const orderRow = await getRepository().findById('printOrders', order.id);
    assert.equal(orderRow.documentName, 'notes.pdf');
  });

  test('20. every step was audited', async () => {
    const logs = await getRepository().findAll('auditLogs', { shopId: shop.id });
    const actions = logs.map((log) => log.action);

    for (const expected of ['order.created', 'order.paid', 'agent.registered', 'job.completed']) {
      assert.ok(actions.includes(expected), `audit trail missing ${expected}`);
    }

    // Credentials must never reach the audit trail.
    const serialised = JSON.stringify(logs);
    assert.equal(serialised.includes(agentKey), false, 'agent key leaked into audit logs');
    assert.equal(serialised.includes('OwnerPass123'), false, 'password leaked into audit logs');
  });
});

describe('end-to-end: failure paths', () => {
  test('a failed simulated payment authorizes no job', async () => {
    const pdf = await makePdf(2);
    const uploadResult = await upload(
      harness.baseUrl,
      { machineId: machine.machineId },
      {
        name: 'two.pdf',
        type: 'application/pdf',
        buffer: pdf,
      },
    );
    const doc = uploadResult.body.data;

    const orderResponse = await request(harness.baseUrl, '/api/orders', {
      method: 'POST',
      body: { machineId: machine.machineId, documentId: doc.id, copies: 1, sides: 'single' },
    });
    const failedOrder = orderResponse.body.data;

    const pay = await request(harness.baseUrl, `/api/orders/${failedOrder.id}/pay`, {
      method: 'POST',
      body: { outcome: 'failure' },
    });

    const confirm = await request(harness.baseUrl, `/api/orders/${failedOrder.id}/confirm`, {
      method: 'POST',
      body: { attemptId: pay.body.data.attemptId, outcome: 'failure' },
    });

    assert.equal(confirm.status, 402);
    assert.equal(confirm.body.error.code, 'PAYMENT_FAILED');

    const jobs = await getRepository().findAll('printJobs', { orderId: failedOrder.id });
    assert.equal(jobs.length, 0, 'a failed payment must never create a print job');

    const row = await getRepository().findById('printOrders', failedOrder.id);
    assert.equal(row.status, 'awaiting_payment', 'order stays unpaid and retryable');
  });

  test("an agent cannot download another machine's job", async () => {
    // A second machine + agent, then try to fetch the first machine's job.
    const secondMachine = await request(harness.baseUrl, '/api/machines', {
      method: 'POST',
      headers: auth(owner.token),
      body: {
        shopId: shop.id,
        name: 'Counter B',
        printer: { model: 'Brother HL-L2350', supportsColor: false, supportsDuplex: true },
      },
    });
    const secondId = secondMachine.body.data.machineId;

    const secondAgent = await request(harness.baseUrl, '/api/agents/register', {
      method: 'POST',
      headers: auth(owner.token),
      body: { machineId: secondId, printMode: 'virtual' },
    });

    const jobs = await getRepository().findAll('printJobs', { shopId: shop.id });
    const anyJob = jobs[0];

    const response = await fetch(`${harness.baseUrl}/api/agents/jobs/${anyJob.id}/document`, {
      headers: {
        'X-Agent-Id': secondAgent.body.data.agent.agentId,
        'X-Agent-Key': secondAgent.body.data.agentKey,
      },
    });

    assert.equal(response.status, 403, "an agent must not read another machine's document");
  });
});
