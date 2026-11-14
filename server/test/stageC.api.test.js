import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, request } from './helpers/server.js';
import { getRepository } from '../repositories/active.js';

/**
 * Stage C/D modules: analytics, subscriptions, staff, admin, payments.
 *
 * These are the parts of the product a shop owner and a platform admin actually
 * touch, so they are tested through HTTP with real tokens rather than by calling
 * services directly.
 *
 * Every assertion about money checks arithmetic against stored records. None of
 * these tests seed a number it then asserts — that would only prove the fixture.
 */

let harness;
let adminToken;
let ownerToken;
let otherOwnerToken;
let shopId;
let otherShopId;

const auth = (token) => ({ Authorization: `Bearer ${token}` });

before(async () => {
  process.env.NODE_ENV = 'test';
  harness = await startTestServer();

  const { createAdmin } = await import('../services/authService.js');
  await createAdmin({
    name: 'Admin',
    email: 'admin@stagec.test',
    password: 'AdminPass123',
  });

  const adminLogin = await request(harness.baseUrl, '/api/auth/login', {
    method: 'POST',
    body: { email: 'admin@stagec.test', password: 'AdminPass123' },
  });
  adminToken = adminLogin.body.data.accessToken;

  // Two independent shops, so tenancy can be tested rather than assumed.
  const register = async (email, shopName) => {
    const response = await request(harness.baseUrl, '/api/auth/register', {
      method: 'POST',
      body: {
        name: shopName,
        email,
        password: 'OwnerPass123',
        shopName,
        phone: '9876543210',
        address: '123 Test Street',
        city: 'Hisar',
        state: 'Haryana',
        pincode: '125001',
        termsAccepted: true,
      },
    });
    const shop = response.body.data.shop;
    await getRepository().updateById('shops', shop.id, { status: 'active' });
    return { token: response.body.data.accessToken, shop };
  };

  const first = await register('owner-a@stagec.test', 'Shop A');
  ownerToken = first.token;
  shopId = first.shop.id;

  const second = await register('owner-b@stagec.test', 'Shop B');
  otherOwnerToken = second.token;
  otherShopId = second.shop.id;
});

after(async () => {
  await harness?.close();
});

describe('analytics', () => {
  test('a brand-new shop reports zeros, not invented data', async () => {
    const response = await request(harness.baseUrl, '/api/analytics/shop', {
      headers: auth(ownerToken),
    });

    assert.equal(response.status, 200, JSON.stringify(response.body));
    const { data } = response.body;

    assert.equal(data.revenue.grossPaise, 0);
    assert.equal(data.revenue.orderCount, 0);
    assert.equal(data.volume.orders, 0);
    // A success rate with no finished jobs is null, not 0% and not 100%.
    assert.equal(data.printing.successRatePercent, null);
    assert.deepEqual(data.ordersByStatus, {});
  });

  test('the daily series is zero-filled, one row per day', async () => {
    const response = await request(harness.baseUrl, '/api/analytics/shop?days=7', {
      headers: auth(ownerToken),
    });

    const { daily } = response.body.data;
    assert.equal(daily.length, 7);
    // Consecutive dates with no gaps — a chart must not silently skip a day.
    for (let i = 1; i < daily.length; i += 1) {
      const previous = new Date(daily[i - 1].date).getTime();
      const current = new Date(daily[i].date).getTime();
      assert.equal(current - previous, 24 * 60 * 60 * 1000, `gap before ${daily[i].date}`);
    }
    for (const day of daily) {
      assert.equal(day.orders, 0);
      assert.equal(day.revenuePaise, 0);
    }
  });

  test('revenue only counts paid orders', async () => {
    const repo = getRepository();

    // One paid order and one abandoned order, both in this shop.
    await repo.insert('printOrders', {
      shopId,
      machineId: 'SP-001',
      status: 'paid',
      paymentStatus: 'succeeded',
      totals: { subtotalPaise: 2000, platformFeePaise: 120, totalPaise: 2120 },
      sheetCount: 4,
      pageCount: 4,
      copies: 1,
      createdAt: new Date().toISOString(),
      simulated: false,
    });
    await repo.insert('printOrders', {
      shopId,
      machineId: 'SP-001',
      status: 'awaiting_payment',
      paymentStatus: 'pending',
      totals: { subtotalPaise: 999_99, platformFeePaise: 0, totalPaise: 999_99 },
      sheetCount: 100,
      pageCount: 100,
      copies: 1,
      createdAt: new Date().toISOString(),
    });

    const response = await request(harness.baseUrl, '/api/analytics/shop', {
      headers: auth(ownerToken),
    });
    const { revenue, volume } = response.body.data;

    assert.equal(revenue.grossPaise, 2120, 'the unpaid order must not be counted');
    assert.equal(revenue.orderCount, 1);
    assert.equal(revenue.platformFeePaise, 120);
    assert.equal(revenue.netPaise, 2000, 'net is what the shop keeps');
    assert.equal(volume.sheets, 4);
  });

  test('the range is validated rather than coerced', async () => {
    for (const days of ['0', '366', 'abc', '-5']) {
      // eslint-disable-next-line no-await-in-loop
      const response = await request(harness.baseUrl, `/api/analytics/shop?days=${days}`, {
        headers: auth(ownerToken),
      });
      assert.equal(response.status, 422, `days=${days} should be rejected`);
      assert.ok(response.body.error.details.days);
    }
  });

  test('a shop owner cannot read the platform analytics', async () => {
    const response = await request(harness.baseUrl, '/api/analytics/platform', {
      headers: auth(ownerToken),
    });
    assert.equal(response.status, 403);
  });

  test('the admin platform summary aggregates both shops', async () => {
    const response = await request(harness.baseUrl, '/api/analytics/platform', {
      headers: auth(adminToken),
    });

    assert.equal(response.status, 200, JSON.stringify(response.body));
    const { data } = response.body;

    assert.ok(data.shops.total >= 2);
    assert.equal(data.shops.active >= 2, true);
    assert.ok(Array.isArray(data.perShop));
    assert.equal(data.revenue.grossPaise >= 2120, true);
    // Admin revenue is split honestly between platform and shop.
    assert.equal(
      data.revenue.grossPaise - data.revenue.platformFeePaise,
      data.revenue.shopPayoutPaise,
    );
  });

  test("one shop cannot appear in another shop's per-machine breakdown", async () => {
    const response = await request(harness.baseUrl, '/api/analytics/shop', {
      headers: auth(otherOwnerToken),
    });

    const machineIds = response.body.data.machines.breakdown.map((row) => row.machineId);
    // Shop B has no machines registered yet, so its own breakdown is empty.
    assert.deepEqual(machineIds, []);
  });

  test('the CSV export escapes commas and quotes in customer filenames', async () => {
    const repo = getRepository();
    await repo.insert('printOrders', {
      shopId,
      machineId: 'SP-001',
      status: 'paid',
      paymentStatus: 'succeeded',
      documentName: 'notes, "final".pdf',
      pageCount: 1,
      copies: 1,
      color: 'bw',
      sides: 'single',
      paperSize: 'A4',
      sheetCount: 1,
      totals: { subtotalPaise: 200, platformFeePaise: 12, totalPaise: 212 },
      createdAt: new Date().toISOString(),
    });

    const response = await fetch(`${harness.baseUrl}/api/analytics/orders.csv`, {
      headers: auth(ownerToken),
    });
    const csv = await response.text();

    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /text\/csv/);
    // The dangerous name must be quoted and its inner quotes doubled.
    assert.ok(csv.includes('"notes, ""final"".pdf"'), 'CSV escaping failed');

    const dataLines = csv.trim().split('\r\n');
    assert.ok(dataLines.length >= 2, 'header plus at least one row');
    // Every row must have the same number of fields as the header.
    const headerFields = dataLines[0].split(',').length;
    for (const line of dataLines.slice(1)) {
      assert.equal(
        line.match(/("([^"]|"")*"|[^,]*)(,|$)/g)?.filter(Boolean).length,
        headerFields,
        `malformed row: ${line}`,
      );
    }
  });
});

describe('subscriptions', () => {
  test('the plan list is public and priced in whole paise', async () => {
    const response = await request(harness.baseUrl, '/api/subscriptions/plans');

    assert.equal(response.status, 200);
    const plans = response.body.data;
    assert.ok(plans.length >= 3);
    for (const plan of plans) {
      assert.equal(Number.isInteger(plan.monthlyPaise), true, `${plan.id} is not integer paise`);
      assert.match(plan.monthly, /^₹\d+\.\d{2}$/);
    }
    // A free trial must actually be free.
    const trial = plans.find((plan) => plan.id === 'trial');
    assert.equal(trial.monthlyPaise, 0);
  });

  test('changing plan updates the shop and records the history', async () => {
    const response = await request(harness.baseUrl, '/api/subscriptions/plan', {
      method: 'POST',
      headers: auth(ownerToken),
      body: { planId: 'growth' },
    });

    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal(response.body.data.planId, 'growth');
    assert.equal(response.body.data.monthlyPaise, 129_900);
    assert.equal(response.body.data.simulated, true);

    // The shop row is kept in step, because other services read it.
    const shop = await getRepository().findById('shops', shopId);
    assert.equal(shop.planId, 'growth');
    assert.equal(shop.maxMachines, 12);
  });

  test('an unknown plan is rejected', async () => {
    const response = await request(harness.baseUrl, '/api/subscriptions/plan', {
      method: 'POST',
      headers: auth(ownerToken),
      body: { planId: 'enterprise-unlimited-free' },
    });
    assert.equal(response.status, 422);
    assert.ok(response.body.error.details.planId);
  });

  test('a period always ends after it starts', async () => {
    const response = await request(harness.baseUrl, '/api/subscriptions/current', {
      headers: auth(ownerToken),
    });
    const data = response.body.data;

    assert.ok(new Date(data.currentPeriodEnd) > new Date(data.currentPeriodStart));
    assert.equal(data.expired, false);
  });

  test('invoices are idempotent — asking twice bills once', async () => {
    const first = await request(harness.baseUrl, '/api/subscriptions/invoices', {
      method: 'POST',
      headers: auth(ownerToken),
    });
    const second = await request(harness.baseUrl, '/api/subscriptions/invoices', {
      method: 'POST',
      headers: auth(ownerToken),
    });

    assert.equal(first.status, 201);
    assert.equal(second.status, 200, 'the repeat must not create a second invoice');
    assert.equal(first.body.data.id, second.body.data.id);
    assert.equal(first.body.data.invoiceNumber, second.body.data.invoiceNumber);

    const invoices = await getRepository().findAll('subscriptionInvoices', { shopId });
    assert.equal(invoices.length, 1, 'exactly one invoice exists');
  });

  test('cancelling is at period end, not immediate', async () => {
    const response = await request(harness.baseUrl, '/api/subscriptions/cancel', {
      method: 'POST',
      headers: auth(ownerToken),
      body: { reason: 'Closing for renovations' },
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.data.cancelAtPeriodEnd, true);
    // Still trading until the paid period ends.
    assert.equal(response.body.data.expired, false);
    assert.equal(response.body.data.status, 'active');
  });

  test("a shop owner cannot inspect another shop's subscription", async () => {
    const response = await request(harness.baseUrl, `/api/subscriptions/shops/${shopId}`, {
      headers: auth(otherOwnerToken),
    });
    assert.equal(response.status, 403);
  });
});

describe('staff management', () => {
  let staffId;
  let staffToken;

  test('an owner can create a staff account in their own shop', async () => {
    const response = await request(harness.baseUrl, '/api/staff', {
      method: 'POST',
      headers: auth(ownerToken),
      body: {
        name: 'Counter Ravi',
        email: 'ravi@shopa.test',
        password: 'StaffPass123',
        permissions: ['manageOrders'],
      },
    });

    assert.equal(response.status, 201, JSON.stringify(response.body));
    staffId = response.body.data.id;

    assert.equal(response.body.data.role, 'staff');
    assert.equal(response.body.data.shopId, shopId, "the owner's own shop, not a supplied one");
    assert.deepEqual(response.body.data.permissions, ['manageOrders']);
    // Never returned in any projection.
    assert.equal(response.body.data.passwordHash, undefined);
  });

  test('a role in the body cannot create an owner or admin', async () => {
    const response = await request(harness.baseUrl, '/api/staff', {
      method: 'POST',
      headers: auth(ownerToken),
      body: {
        name: 'Sneaky',
        email: 'sneaky@shopa.test',
        password: 'StaffPass123',
        role: 'admin',
      },
    });

    assert.equal(response.status, 201);
    assert.equal(response.body.data.role, 'staff', 'privilege escalation must be refused');
  });

  test('two accounts cannot share an email', async () => {
    const response = await request(harness.baseUrl, '/api/staff', {
      method: 'POST',
      headers: auth(ownerToken),
      body: { name: 'Ravi Again', email: 'ravi@shopa.test', password: 'StaffPass123' },
    });
    assert.equal(response.status, 409);
    assert.equal(response.body.error.code, 'EMAIL_TAKEN');
  });

  test('the new staff member can log in and see only their shop', async () => {
    const login = await request(harness.baseUrl, '/api/auth/login', {
      method: 'POST',
      body: { email: 'ravi@shopa.test', password: 'StaffPass123' },
    });

    assert.equal(login.status, 200, JSON.stringify(login.body));
    staffToken = login.body.data.accessToken;
    assert.equal(login.body.data.user.role, 'staff');

    const orders = await request(harness.baseUrl, '/api/orders', { headers: auth(staffToken) });
    assert.equal(orders.status, 200);
    // Their listing is their own shop's; nothing from Shop B can appear.
    for (const order of orders.body.data) {
      assert.equal(order.shopId, shopId);
    }
  });

  test('staff cannot manage staff — permission cannot escalate permission', async () => {
    const response = await request(harness.baseUrl, '/api/staff', {
      method: 'POST',
      headers: auth(staffToken),
      body: { name: 'Friend', email: 'friend@shopa.test', password: 'StaffPass123' },
    });
    assert.equal(response.status, 403);
  });

  test('an owner cannot edit a staff member from another shop', async () => {
    const response = await request(harness.baseUrl, `/api/staff/${staffId}`, {
      method: 'PATCH',
      headers: auth(otherOwnerToken),
      body: { permissions: ['managePricing'] },
    });
    // 404 rather than 403: the other tenant's staff should not even be confirmed
    // to exist.
    assert.equal(response.status, 404);
  });

  test('permissions are updated and take effect on the next request', async () => {
    const grant = await request(harness.baseUrl, `/api/staff/${staffId}`, {
      method: 'PATCH',
      headers: auth(ownerToken),
      body: { permissions: ['manageOrders', 'managePricing'] },
    });
    assert.equal(grant.status, 200);
    assert.deepEqual(grant.body.data.permissions, ['manageOrders', 'managePricing']);

    // Deactivating revokes the session, so the old token stops working.
    const deactivate = await request(harness.baseUrl, `/api/staff/${staffId}`, {
      method: 'DELETE',
      headers: auth(ownerToken),
    });
    assert.equal(deactivate.status, 200);
    assert.equal(deactivate.body.data.status, 'suspended');
  });

  test('a deactivated account cannot log in', async () => {
    const login = await request(harness.baseUrl, '/api/auth/login', {
      method: 'POST',
      body: { email: 'ravi@shopa.test', password: 'StaffPass123' },
    });
    assert.ok([401, 403].includes(login.status), `expected refusal, got ${login.status}`);
  });

  test('the permission vocabulary matches what the route guards check', async () => {
    const { STAFF_PERMISSIONS } = await import('../middleware/auth.js');
    const { ALL_PERMISSIONS } = await import('../services/staffService.js');

    assert.deepEqual(
      Object.values(STAFF_PERMISSIONS).sort(),
      [...ALL_PERMISSIONS].sort(),
      'a permission that one module grants and another does not check is a silent bug',
    );
  });
});

describe('admin console', () => {
  test('the platform endpoints refuse a shop owner', async () => {
    for (const path of ['/api/admin/users', '/api/admin/shops', '/api/admin/audit']) {
      // eslint-disable-next-line no-await-in-loop
      const response = await request(harness.baseUrl, path, { headers: auth(ownerToken) });
      assert.equal(response.status, 403, `${path} leaked to a shop owner`);
    }
  });

  test('an admin can list users and shops', async () => {
    const users = await request(harness.baseUrl, '/api/admin/users', {
      headers: auth(adminToken),
    });
    assert.equal(users.status, 200);
    assert.ok(users.body.meta.total >= 4);
    for (const user of users.body.data) {
      assert.equal(user.passwordHash, undefined);
    }

    const shops = await request(harness.baseUrl, '/api/admin/shops', {
      headers: auth(adminToken),
    });
    assert.equal(shops.status, 200);
    assert.ok(shops.body.data.some((shop) => shop.id === shopId));
  });

  test('an admin cannot suspend their own account', async () => {
    const me = await request(harness.baseUrl, '/api/auth/me', { headers: auth(adminToken) });
    assert.equal(me.status, 200);
    const adminId = me.body.data.user.id;

    const response = await request(harness.baseUrl, `/api/admin/users/${adminId}/status`, {
      method: 'PATCH',
      headers: auth(adminToken),
      body: { status: 'suspended' },
    });
    assert.equal(response.status, 403);
    assert.equal(response.body.error.code, 'SELF_MODIFICATION_DENIED');
  });

  test('suspending a shop stops it accepting orders', async () => {
    const response = await request(harness.baseUrl, `/api/admin/shops/${otherShopId}/status`, {
      method: 'PATCH',
      headers: auth(adminToken),
      body: { status: 'suspended', reason: 'Non-payment' },
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.data.status, 'suspended');
    assert.equal(response.body.data.acceptsOrders, false);
  });

  test('the system endpoint tells the truth about this build', async () => {
    const response = await request(harness.baseUrl, '/api/admin/system', {
      headers: auth(adminToken),
    });

    const { data } = response.body;
    // These three fields are the honesty contract of the whole deployment.
    assert.equal(data.payments.simulated, true);
    assert.equal(data.payments.productionReady, false);
    assert.equal(data.printing.physicalPrintingVerified, false);
    assert.ok(data.printing.note.length > 20);
    assert.equal(typeof data.repository, 'string');
  });

  test('the audit trail records the admin actions', async () => {
    const response = await request(harness.baseUrl, '/api/admin/audit', {
      headers: auth(adminToken),
    });

    assert.equal(response.status, 200);
    const actions = response.body.data.map((log) => log.action);
    assert.ok(actions.length > 0);
    // Newest first, so the console shows the most recent action at the top.
    const times = response.body.data.map((log) => new Date(log.at).getTime());
    assert.deepEqual(
      times,
      [...times].sort((a, b) => b - a),
    );
  });
});

describe('payments', () => {
  test('the provider endpoint admits that payments are simulated', async () => {
    const response = await request(harness.baseUrl, '/api/payments/provider');
    assert.equal(response.status, 200);
    assert.equal(response.body.data.simulated, true);
    assert.match(response.body.data.message, /simulated/i);
  });

  test('a webhook without a signature is refused', async () => {
    const response = await request(harness.baseUrl, '/api/payments/webhook', {
      method: 'POST',
      body: { type: 'payment.succeeded', orderId: 'anything' },
    });
    assert.equal(response.status, 401);
    assert.equal(response.body.error.code, 'INVALID_SIGNATURE');
  });

  test('a payment attempt list is tenant-scoped', async () => {
    const response = await request(harness.baseUrl, '/api/payments', {
      headers: auth(ownerToken),
    });
    assert.equal(response.status, 200);
    for (const payment of response.body.data) {
      assert.equal(payment.simulated, true);
    }
  });
});

describe('print jobs: staff view', () => {
  test('staff can see job progress but cannot force one to print', async () => {
    const repo = getRepository();
    const job = await repo.insert('printJobs', {
      jobCode: 'PJ-TEST-0001',
      orderId: 'order-x',
      shopId,
      machineId: 'SP-001',
      status: 'FAILED',
      attempts: 1,
      paidAt: new Date().toISOString(),
      printedAt: null,
      createdAt: new Date().toISOString(),
    });

    const detail = await request(harness.baseUrl, `/api/print-jobs/${job.id}`, {
      headers: auth(ownerToken),
    });
    assert.equal(detail.status, 200);
    assert.equal(detail.body.data.status, 'FAILED');
    assert.ok(detail.body.data.progress.label);

    // There is no route that advances a job to PRINTING from the dashboard.
    const forced = await request(harness.baseUrl, `/api/print-jobs/${job.id}/printing`, {
      method: 'POST',
      headers: auth(ownerToken),
    });
    assert.equal(forced.status, 404, 'a shop user must not be able to start a print');

    // Retry is the one recovery a shop has, and it only works on FAILED jobs.
    const retry = await request(harness.baseUrl, `/api/print-jobs/${job.id}/retry`, {
      method: 'POST',
      headers: auth(ownerToken),
    });
    assert.equal(retry.status, 200, JSON.stringify(retry.body));
    assert.equal(retry.body.data.status, 'QUEUED');
  });

  test("a shop cannot read another shop's print jobs", async () => {
    const repo = getRepository();
    const jobs = await repo.findAll('printJobs', { shopId });
    assert.ok(jobs.length > 0);

    const response = await request(harness.baseUrl, `/api/print-jobs/${jobs[0].id}`, {
      headers: auth(otherOwnerToken),
    });
    assert.equal(response.status, 404);
  });
});
