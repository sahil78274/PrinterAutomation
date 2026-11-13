import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, request } from './helpers/server.js';

/**
 * First-admin bootstrap and revenue honesty.
 *
 * Two things that would be catastrophic to get wrong:
 *
 *  1. The bootstrap endpoint must not become an open "become an admin" route.
 *  2. Analytics must never present simulated money as real takings.
 */

const SETUP_KEY = 'test-setup-key-abcdefghijklmnop';

let harness;

before(async () => {
  process.env.NODE_ENV = 'test';
  harness = await startTestServer({ env: { ADMIN_SETUP_KEY: SETUP_KEY } });
});

after(async () => {
  await harness?.close();
  delete process.env.ADMIN_SETUP_KEY;
});

const body = (overrides = {}) => ({
  name: 'Boot Admin',
  email: `boot-${Date.now()}-${Math.random().toString(16).slice(2)}@test.local`,
  password: 'AdminPass123',
  setupKey: SETUP_KEY,
  ...overrides,
});

describe('bootstrap-admin', () => {
  test('refuses a wrong setup key', async () => {
    const response = await request(harness.baseUrl, '/api/auth/bootstrap-admin', {
      method: 'POST',
      body: body({ setupKey: 'not-the-key' }),
    });

    assert.equal(response.status, 401);
    assert.equal(response.body.error.code, 'INVALID_SETUP_KEY');
  });

  test('refuses a request with no setup key at all', async () => {
    const response = await request(harness.baseUrl, '/api/auth/bootstrap-admin', {
      method: 'POST',
      body: body({ setupKey: '' }),
    });
    // Validation rejects the missing field before the key is ever compared.
    assert.ok([401, 422].includes(response.status));
  });

  test('creates an admin with the correct key', async () => {
    const response = await request(harness.baseUrl, '/api/auth/bootstrap-admin', {
      method: 'POST',
      body: body(),
    });

    assert.equal(response.status, 201, JSON.stringify(response.body));
    assert.equal(response.body.data.user.role, 'admin');
    assert.equal(response.body.data.user.shopId, null);
    // A password hash must never be part of any response.
    assert.equal(response.body.data.user.passwordHash, undefined);
  });

  test('the created admin can log in and reach the admin console', async () => {
    const email = `boot-login-${Date.now()}@test.local`;
    await request(harness.baseUrl, '/api/auth/bootstrap-admin', {
      method: 'POST',
      body: body({ email }),
    });

    const login = await request(harness.baseUrl, '/api/auth/login', {
      method: 'POST',
      body: { email, password: 'AdminPass123' },
    });
    assert.equal(login.status, 200);

    const system = await request(harness.baseUrl, '/api/admin/system', {
      headers: { Authorization: `Bearer ${login.body.data.accessToken}` },
    });
    assert.equal(system.status, 200);
    // The honesty contract, asserted through a real admin session.
    assert.equal(system.body.data.payments.simulated, true);
    assert.equal(system.body.data.printing.physicalPrintingVerified, false);
  });

  test('a weak password is refused even with the right key', async () => {
    const response = await request(harness.baseUrl, '/api/auth/bootstrap-admin', {
      method: 'POST',
      body: body({ password: 'abc' }),
    });

    assert.equal(response.status, 422);
    assert.ok(response.body.error.details.password);
  });
});

describe('revenue honesty', () => {
  test('simulated revenue is separated from real revenue', async () => {
    const { getRepository } = await import('../repositories/active.js');
    const { shopSummary } = await import('../services/analyticsService.js');
    const repo = getRepository();

    const shop = await repo.insert('shops', {
      name: 'Revenue Shop',
      shopCode: 'SH-REV01',
      status: 'active',
      settings: { acceptOrders: true },
      createdAt: new Date().toISOString(),
    });

    const now = new Date().toISOString();
    const order = (totals, simulated) => ({
      shopId: shop.id,
      machineId: 'SP-900',
      status: 'paid',
      paymentStatus: 'succeeded',
      totals,
      sheetCount: 1,
      pageCount: 1,
      copies: 1,
      createdAt: now,
      simulated,
    });

    // One simulated payment (development provider) and one real one.
    await repo.insert(
      'printOrders',
      order({ subtotalPaise: 1000, platformFeePaise: 60, totalPaise: 1060 }, true),
    );
    await repo.insert(
      'printOrders',
      order({ subtotalPaise: 2000, platformFeePaise: 120, totalPaise: 2120 }, false),
    );

    const summary = await shopSummary(shop.id, { days: 7 });

    assert.equal(summary.revenue.grossPaise, 3180, 'the total includes both');
    assert.equal(summary.revenue.simulatedPaise, 1060, 'simulated is reported separately');
    assert.equal(summary.revenue.realPaise, 2120, 'real takings are their own figure');
    assert.equal(
      summary.revenue.simulatedPaise + summary.revenue.realPaise,
      summary.revenue.grossPaise,
      'the split must add up to the total',
    );
    assert.equal(summary.revenue.entirelySimulated, false);
  });

  test('a shop whose only revenue is simulated is flagged as such', async () => {
    const { getRepository } = await import('../repositories/active.js');
    const { shopSummary } = await import('../services/analyticsService.js');
    const repo = getRepository();

    const shop = await repo.insert('shops', {
      name: 'Simulated Shop',
      shopCode: 'SH-SIM01',
      status: 'active',
      settings: { acceptOrders: true },
      createdAt: new Date().toISOString(),
    });

    await repo.insert('printOrders', {
      shopId: shop.id,
      machineId: 'SP-901',
      status: 'paid',
      paymentStatus: 'succeeded',
      totals: { subtotalPaise: 900, platformFeePaise: 54, totalPaise: 954 },
      sheetCount: 3,
      pageCount: 3,
      copies: 1,
      createdAt: new Date().toISOString(),
      simulated: true,
    });

    const summary = await shopSummary(shop.id, { days: 7 });
    assert.equal(summary.revenue.realPaise, 0);
    assert.equal(summary.revenue.grossPaise, 954);
    assert.equal(
      summary.revenue.entirelySimulated,
      true,
      'a dashboard must be able to tell that none of this money is real',
    );
  });

  test('an unpaid order contributes nothing to revenue', async () => {
    const { getRepository } = await import('../repositories/active.js');
    const { shopSummary } = await import('../services/analyticsService.js');
    const repo = getRepository();

    const shop = await repo.insert('shops', {
      name: 'Unpaid Shop',
      shopCode: 'SH-UNP01',
      status: 'active',
      settings: { acceptOrders: true },
      createdAt: new Date().toISOString(),
    });

    await repo.insert('printOrders', {
      shopId: shop.id,
      machineId: 'SP-902',
      status: 'awaiting_payment',
      paymentStatus: 'pending',
      totals: { subtotalPaise: 50_000, platformFeePaise: 0, totalPaise: 50_000 },
      sheetCount: 10,
      pageCount: 10,
      copies: 1,
      createdAt: new Date().toISOString(),
    });

    const summary = await shopSummary(shop.id, { days: 7 });
    assert.equal(summary.revenue.grossPaise, 0, 'an abandoned payment is not turnover');
    assert.equal(summary.revenue.orderCount, 0);
    // It is still counted as an order for volume purposes, which is useful.
    assert.equal(summary.volume.orders, 1);
  });
});
