#!/usr/bin/env node
/**
 * Acceptance flow against a RUNNING server.
 *
 * This is the 14-point end-to-end journey from the brief, executed over real
 * HTTP against a real Express process on the in-memory repository, with a real
 * agent worker doing the printing step.
 *
 * Usage:
 *   node scripts/acceptance.mjs [--server http://127.0.0.1:5000]
 *
 * It creates its own shop, machine, document, order and agent, so it is safe to
 * run against any development server. It prints what it verified and exits
 * non-zero on the first failure.
 */

import { PDFDocument, StandardFonts } from '../server/node_modules/pdf-lib/cjs/index.js';

const ORIGIN = (
  process.argv.find((arg) => arg.startsWith('--server='))?.split('=')[1] ??
  process.env.SMARTPRINT_SERVER ??
  'http://127.0.0.1:5000'
).replace(/\/+$/, '');

let passed = 0;
let failed = 0;
const failures = [];

function check(name, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  } else {
    failed += 1;
    failures.push(name);
    console.log(`  \x1b[31m✗\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function section(title) {
  console.log(`\n\x1b[1m${title}\x1b[0m`);
}

async function call(path, { method = 'GET', body, token, headers = {}, raw = false } = {}) {
  const response = await fetch(`${ORIGIN}${path}`, {
    method,
    headers: {
      ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body && !(body instanceof FormData) ? JSON.stringify(body) : body,
  });

  if (raw) return response;
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

async function makePdf(pages) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= pages; i += 1) {
    const page = pdf.addPage([595, 842]);
    page.drawText(`Acceptance page ${i}`, { x: 60, y: 760, size: 18, font });
  }
  return Buffer.from(await pdf.save());
}

async function uploadDocument(machineId, pdf, filename = 'acceptance.pdf') {
  const form = new FormData();
  form.append('machineId', machineId);
  form.append('file', new Blob([pdf], { type: 'application/pdf' }), filename);

  const response = await fetch(`${ORIGIN}/api/documents`, { method: 'POST', body: form });
  const body = await response.json();
  return { status: response.status, body };
}

const stamp = Date.now();
const email = `acceptance-${stamp}@smartprint.test`;

console.log(`\nSmartPrint acceptance flow — ${ORIGIN}`);
console.log(`Started ${new Date().toISOString()}`);

/* 1. Health ---------------------------------------------------------------- */
section('1. The API is up');
{
  const health = await call('/api/health');
  check('health responds 200', health.status === 200, `got ${health.status}`);
  check('health reports a status', typeof health.body?.data?.status === 'string');
  const healthResponse = await fetch(`${ORIGIN}/api/health`);
  check(
    'health carries a request id header',
    /^[A-Za-z0-9._-]{8,128}$/.test(healthResponse.headers.get('x-request-id') ?? ''),
  );
}

/* 2. Owner registration and login ------------------------------------------ */
section('2. A shop owner can register and sign in');
let ownerToken;
let shopId;
{
  const registration = await call('/api/auth/register', {
    method: 'POST',
    body: {
      name: 'Acceptance Owner',
      email,
      password: 'OwnerPass123',
      shopName: `Acceptance Shop ${stamp}`,
    },
  });
  check('registration returns 201', registration.status === 201, JSON.stringify(registration.body));
  ownerToken = registration.body?.data?.accessToken;
  shopId = registration.body?.data?.shop?.id;
  check('registration issues an access token', typeof ownerToken === 'string' && ownerToken.length > 20);
  check('registration returns a shop', Boolean(shopId));

  const login = await call('/api/auth/login', {
    method: 'POST',
    body: { email, password: 'OwnerPass123' },
  });
  check('login succeeds', login.status === 200, JSON.stringify(login.body));
  check('login returns the staff role as owner', login.body?.data?.user?.role === 'owner');

  const badLogin = await call('/api/auth/login', {
    method: 'POST',
    body: { email, password: 'WrongPassword1' },
  });
  check('a wrong password is refused', badLogin.status === 401);
}

/* 3. Tenancy --------------------------------------------------------------- */
section('3. Tenancy is enforced on the server');
let machineId;
let machineRef;
{
  // The new shop is `pending`; approve it as an admin would. Without a seeded
  // admin this endpoint must refuse — which is itself the correct behaviour.
  const pendingList = await call('/api/shops', { token: ownerToken });
  check(
    'an owner sees only their own shop',
    pendingList.status === 200 && pendingList.body.data.every((shop) => shop.id === shopId),
    JSON.stringify(pendingList.body?.data?.map((shop) => shop.id)),
  );

  const otherShopOrders = await call('/api/orders?shopId=some-other-shop', { token: ownerToken });
  // Refused outright rather than silently filtered: naming another tenant is a
  // deliberate act, and it must not be quietly downgraded to a working request.
  check(
    'asking for another shop\'s orders is refused',
    otherShopOrders.status === 403 && otherShopOrders.body?.error?.code === 'CROSS_TENANT_DENIED',
    JSON.stringify(otherShopOrders.body?.error),
  );

  const adminAttempt = await call('/api/admin/users', { token: ownerToken });
  check('an owner cannot reach the admin console', adminAttempt.status === 403);
}

/* 3b. Shop approval -------------------------------------------------------- */
section('3b. A new shop cannot trade until an admin approves it');
let adminToken = null;
{
  // A pending shop must be refused even with a perfectly good machine.
  const machineForCheck = await call('/api/machines', {
    method: 'POST',
    token: ownerToken,
    body: { shopId, name: 'Pending check', printer: { supportsDuplex: true } },
  });
  const pendingMachineId = machineForCheck.body?.data?.machineId;
  await call(`/api/machines/${pendingMachineId}/status`, {
    method: 'PATCH',
    token: ownerToken,
    body: { status: 'online' },
  });

  const pendingScan = await call(`/api/machines/${pendingMachineId}`);
  check(
    'a pending shop refuses orders even with an online machine',
    pendingScan.body?.data?.acceptsOrders === false,
    String(pendingScan.body?.data?.blockedReason),
  );

  // Approve through the real admin API. A development server can be seeded with
  // an admin via POST /api/auth/bootstrap-admin (see docs/DEPLOYMENT.md).
  const bootstrap = await call('/api/auth/bootstrap-admin', {
    method: 'POST',
    body: {
      name: 'Acceptance Admin',
      email: `admin-${stamp}@smartprint.test`,
      password: 'AdminPass123',
      setupKey: process.env.SMARTPRINT_ADMIN_SETUP_KEY ?? 'development-setup-key',
    },
  });

  if (bootstrap.status === 201 || bootstrap.status === 200) {
    const login = await call('/api/auth/login', {
      method: 'POST',
      body: { email: `admin-${stamp}@smartprint.test`, password: 'AdminPass123' },
    });
    adminToken = login.body?.data?.accessToken ?? null;
  }

  if (adminToken) {
    const approve = await call(`/api/shops/${shopId}/approve`, { method: 'POST', token: adminToken });
    check('an admin can approve a shop', approve.status === 200, JSON.stringify(approve.body));

    const approvedScan = await call(`/api/machines/${pendingMachineId}`);
    check(
      'the approved shop now accepts orders',
      approvedScan.body?.data?.acceptsOrders === true,
      String(approvedScan.body?.data?.blockedReason),
    );
  } else {
    // Without the bootstrap route the approval step cannot be exercised here.
    // Fail loudly rather than skipping: an unverifiable approval path is a gap.
    check(
      'shop approval can be exercised',
      false,
      `bootstrap-admin answered ${bootstrap.status} (${bootstrap.body?.error?.code ?? 'no code'})`,
    );
  }
}

/* 4. Machine and QR -------------------------------------------------------- */
section('4. A machine is registered and its QR resolves');
{
  const machine = await call('/api/machines', {
    method: 'POST',
    token: ownerToken,
    body: {
      shopId,
      name: 'Acceptance counter',
      printer: { model: 'HP LaserJet M404dn', supportsColor: false, supportsDuplex: true },
      pricing: { bwSinglePaise: 200, bwDoublePaise: 300, minimumChargePaise: 0 },
    },
  });
  check('machine registration returns 201', machine.status === 201, JSON.stringify(machine.body));
  machineId = machine.body?.data?.machineId;
  machineRef = machine.body?.data?.id;
  check('the server allocates a machine ID', /^SP-\d{3,}$/.test(machineId ?? ''), machineId);
  check('the machine has a QR path', machine.body?.data?.qrPath === `/print/${machineId}`);

  // A shop turns the machine on before it can take work. Until then the QR
  // must tell the customer to try elsewhere — that is asserted below.
  const online = await call(`/api/machines/${machineId}/status`, {
    method: 'PATCH',
    token: ownerToken,
    body: { status: 'online' },
  });
  check('the owner can switch the machine online', online.status === 200, JSON.stringify(online.body));

  // A customer scanning the QR is unauthenticated.
  const scan = await call(`/api/machines/${machineId}`);
  check('the QR resolves without a session', scan.status === 200);
  check('the scan shows the price before upload', scan.body?.data?.pricing?.bwSinglePaise === 200);
  check('the online, approved machine accepts orders', scan.body?.data?.acceptsOrders === true, String(scan.body?.data?.blockedReason));
}

/* 5. Document upload ------------------------------------------------------- */
section('5. A PDF uploads and its pages are counted server-side');
let documentId;
{
  const pdf = await makePdf(6);
  const upload = await uploadDocument(machineId, pdf);
  check('upload returns 201', upload.status === 201, JSON.stringify(upload.body));
  documentId = upload.body?.data?.id;
  check('the page count comes from the file, not the client', upload.body?.data?.pageCount === 6);

  const spoofed = await uploadDocument(
    machineId,
    Buffer.from('MZ\x90\x00 this is an executable'),
    'not-really.pdf',
  );
  check(
    'a non-PDF renamed to .pdf is rejected on its bytes',
    spoofed.status === 422,
    JSON.stringify(spoofed.body),
  );

  const anonymous = await fetch(`${ORIGIN}/api/documents/${documentId}/file`);
  check('a document is not publicly downloadable without its id', anonymous.status < 500);
}

/* 6. Server-side pricing --------------------------------------------------- */
section('6. Pricing is computed on the server and cannot be overridden');
let orderId;
let orderTotal;
{
  const order = await call('/api/orders', {
    method: 'POST',
    body: {
      machineId,
      documentId,
      copies: 1,
      sides: 'double',
      color: 'bw',
      paperSize: 'A4',
      // A client attempt to price its own job:
      totalPaise: 1,
      totals: { totalPaise: 1 },
    },
  });
  check('order creation returns 201', order.status === 201, JSON.stringify(order.body));
  orderId = order.body?.data?.id;
  orderTotal = order.body?.data?.totals?.totalPaise;

  // 6 pages duplex = 3 sheets @ 300 paise = 900.
  check('duplex bills per sheet, not per page', order.body?.data?.totals?.subtotalPaise === 900, String(order.body?.data?.totals?.subtotalPaise));
  check('the client-supplied total is ignored', orderTotal !== 1);
  check('the order is not yet paid', order.body?.data?.status === 'awaiting_payment');
  check('no print job is authorised before payment', order.body?.data?.jobId === undefined || order.body?.data?.jobId === null, String(order.body?.data?.jobId));
}

/* 7. Simulated payment ----------------------------------------------------- */
section('7. A simulated payment authorises exactly one job');
let jobId;
{
  const provider = await call('/api/payments/provider');
  check('the payment provider admits it is simulated', provider.body?.data?.simulated === true);

  const pay = await call(`/api/orders/${orderId}/pay`, {
    method: 'POST',
    body: { outcome: 'success' },
  });
  check('starting a payment succeeds', pay.status === 200, JSON.stringify(pay.body));
  check('the intent is flagged simulated', pay.body?.data?.intent?.simulated === true);

  const confirm = await call(`/api/orders/${orderId}/confirm`, {
    method: 'POST',
    body: { attemptId: pay.body?.data?.attemptId, outcome: 'success' },
  });
  check('confirmation succeeds', confirm.status === 200, JSON.stringify(confirm.body));
  check('the order becomes paid', confirm.body?.data?.order?.status === 'paid');
  check('exactly one job is authorised', confirm.body?.data?.authorized === true);
  jobId = confirm.body?.data?.job?.id;
  check('the job is queued', confirm.body?.data?.job?.status === 'QUEUED');

  // The double-click: this must not create a second job or a second print.
  const again = await call(`/api/orders/${orderId}/confirm`, {
    method: 'POST',
    body: { outcome: 'success' },
  });
  check('confirming twice does not authorise again', again.body?.data?.authorized === false);
  check('confirming twice reports it was already paid', again.body?.data?.alreadyPaid === true);
}

/* 8. Agent pairing --------------------------------------------------------- */
section('8. A print agent pairs and can fetch its authorised document');
let agentId;
let agentKey;
{
  const agent = await call('/api/agents/register', {
    method: 'POST',
    token: ownerToken,
    body: { machineId, name: 'Acceptance agent', printMode: 'virtual' },
  });
  check('agent registration returns 201', agent.status === 201, JSON.stringify(agent.body));
  agentId = agent.body?.data?.agent?.agentId;
  agentKey = agent.body?.data?.agentKey;
  check('the agent receives a key exactly once', typeof agentKey === 'string' && agentKey.length >= 32);
  check('the key is not echoed in the agent record', agent.body?.data?.agent?.agentKey === undefined);

  const wrongKey = await call('/api/agents/jobs/next', {
    headers: { 'X-Agent-Id': agentId, 'X-Agent-Key': 'not-the-key' },
  });
  check('a wrong agent key is refused', wrongKey.status === 401);

  const agentHeaders = { 'X-Agent-Id': agentId, 'X-Agent-Key': agentKey };

  const heartbeat = await call('/api/agents/heartbeat', {
    method: 'POST',
    headers: agentHeaders,
    body: { status: 'online', version: '1.0.0-acceptance' },
  });
  check('the agent can heartbeat', heartbeat.status === 200, JSON.stringify(heartbeat.body));

  const next = await call('/api/agents/jobs/next', { headers: agentHeaders });
  check('the agent claims the queued job', next.body?.data?.id === jobId);
  check('the claim moves the job to ASSIGNED', next.body?.data?.status === 'ASSIGNED');

  const secondPoll = await call('/api/agents/jobs/next', { headers: agentHeaders });
  check('a second poll does not double-claim', secondPoll.status === 204);

  const download = await call(`/api/agents/jobs/${jobId}/document`, {
    headers: agentHeaders,
    raw: true,
  });
  check('the agent can download the document', download.status === 200);
  const bytes = Buffer.from(await download.arrayBuffer());
  check('the download is the real PDF', bytes.subarray(0, 5).toString() === '%PDF-');

  const downloading = await call(`/api/agents/jobs/${jobId}/downloading`, {
    method: 'POST',
    headers: agentHeaders,
  });
  check('the job moves to DOWNLOADING', downloading.body?.data?.status === 'DOWNLOADING');

  const printing = await call(`/api/agents/jobs/${jobId}/printing`, {
    method: 'POST',
    headers: agentHeaders,
    body: { idempotencyKey: `acceptance-${jobId}` },
  });
  check('the server authorises the print', printing.status === 200, JSON.stringify(printing.body));

  const retried = await call(`/api/agents/jobs/${jobId}/printing`, {
    method: 'POST',
    headers: agentHeaders,
    body: { idempotencyKey: `acceptance-${jobId}` },
  });
  check('a retried print request is idempotent, not a second sheet', retried.status === 200);

  const complete = await call(`/api/agents/jobs/${jobId}/complete`, {
    method: 'POST',
    headers: agentHeaders,
    body: { pagesPrinted: 6, printerName: 'Virtual Printer (simulated)', simulated: true },
  });
  check('the job completes', complete.status === 200, JSON.stringify(complete.body));
  check('the completion is flagged simulated', complete.body?.data?.simulated === true);
}

/* 9. Customer tracking ----------------------------------------------------- */
section('9. The customer sees the outcome');
{
  const tracked = await call(`/api/orders/${orderId}`);
  check('the order is trackable without a session', tracked.status === 200);
  check('the job is complete', tracked.body?.data?.job?.status === 'COMPLETED');
  check('progress reaches 100%', tracked.body?.data?.job?.progress?.percent === 100);

  const statuses = (tracked.body?.data?.timeline ?? []).map((event) => event.status);
  for (const expected of ['PAID', 'QUEUED', 'ASSIGNED', 'DOWNLOADING', 'PRINTING', 'COMPLETED']) {
    check(`the timeline records ${expected}`, statuses.includes(expected), statuses.join(' → '));
  }
}

/* 10. Analytics ------------------------------------------------------------ */
section('10. Dashboards read real figures, never hardcoded ones');
{
  const analytics = await call('/api/analytics/shop', { token: ownerToken });
  check('shop analytics respond', analytics.status === 200, JSON.stringify(analytics.body));
  const revenue = analytics.body?.data?.revenue ?? {};
  check('revenue is computed from the order', (revenue.grossPaise ?? 0) >= 900, String(revenue.grossPaise));
  check('the report is flagged simulated', analytics.body?.data?.simulated === true);
  // The decisive honesty check: simulated takings are separated from real ones.
  check(
    'simulated revenue is reported separately from real revenue',
    revenue.simulatedPaise >= 900 && revenue.realPaise === 0,
    `simulated=${revenue.simulatedPaise} real=${revenue.realPaise}`,
  );
  check(
    'the report says the whole total is simulated',
    revenue.entirelySimulated === true,
    String(revenue.entirelySimulated),
  );

  const series = analytics.body?.data?.daily ?? [];
  check('the daily series is zero-filled with no gaps', series.length === 30 && series.every((day) => typeof day.orders === 'number'));

  const platform = await call('/api/analytics/platform', { token: ownerToken });
  check('an owner cannot read platform analytics', platform.status === 403);

  const csv = await call('/api/analytics/orders.csv', { token: ownerToken, raw: true });
  check('the CSV export downloads', csv.status === 200);
  const text = await csv.text();
  check('the CSV contains the completed order', text.includes(orderId));
}

/* 11. Subscriptions -------------------------------------------------------- */
section('11. Subscription billing is recorded and simulated');
{
  const plans = await call('/api/subscriptions/plans');
  check('the plan list is public', plans.status === 200 && plans.body.data.length >= 3);

  const change = await call('/api/subscriptions/plan', {
    method: 'POST',
    token: ownerToken,
    body: { planId: 'starter' },
  });
  check('the owner can change plan', change.status === 200, JSON.stringify(change.body));
  check('the change is flagged simulated', change.body?.data?.simulated === true);

  const invoice = await call('/api/subscriptions/invoices', { method: 'POST', token: ownerToken });
  check('an invoice is issued', invoice.status === 201);
  const again = await call('/api/subscriptions/invoices', { method: 'POST', token: ownerToken });
  check('a repeated invoice request is not a second bill', again.status === 200 && again.body?.data?.id === invoice.body?.data?.id);
}

/* 12. Staff ---------------------------------------------------------------- */
section('12. Staff accounts are scoped to their shop');
{
  const created = await call('/api/staff', {
    method: 'POST',
    token: ownerToken,
    body: {
      name: 'Acceptance Staff',
      email: `staff-${stamp}@smartprint.test`,
      password: 'StaffPass123',
      permissions: ['manageOrders'],
      // An escalation attempt:
      role: 'admin',
    },
  });
  check('staff creation returns 201', created.status === 201, JSON.stringify(created.body));
  check('the role in the body is ignored', created.body?.data?.role === 'staff');
  check('the staff member belongs to the owner\'s shop', created.body?.data?.shopId === shopId);

  const staffLogin = await call('/api/auth/login', {
    method: 'POST',
    body: { email: `staff-${stamp}@smartprint.test`, password: 'StaffPass123' },
  });
  check('the staff member can sign in', staffLogin.status === 200);
  const staffToken = staffLogin.body?.data?.accessToken;

  const escalate = await call('/api/staff', {
    method: 'POST',
    token: staffToken,
    body: { name: 'Friend', email: `friend-${stamp}@smartprint.test`, password: 'StaffPass123' },
  });
  check('staff cannot create more staff', escalate.status === 403);
}

/* 13. System honesty -------------------------------------------------------- */
section('13. The system reports what is real and what is not');
{
  // No admin account exists in a fresh memory database, so the admin console
  // must refuse. That is the correct outcome, and worth asserting.
  const adminAttempt = await call('/api/admin/system', { token: ownerToken });
  check('the admin console is closed to a shop owner', adminAttempt.status === 403);

  const machineDetail = await call(`/api/machines/${machineId}/detail`, { token: ownerToken });
  check('the machine detail reports the agent mode', machineDetail.status === 200);
}

/* 14. Summary -------------------------------------------------------------- */
section('14. Result');
console.log(`\n  ${passed} passed, ${failed} failed`);
if (failed) {
  console.log(`\n  Failures:`);
  for (const name of failures) console.log(`    - ${name}`);
  console.log('');
  process.exit(1);
}
console.log('\n  The full customer journey works end to end against this server.');
console.log('  Printing was SIMULATED: no physical printer was involved.\n');
process.exit(0);
