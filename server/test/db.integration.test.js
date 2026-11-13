import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import config from '../config/index.js';
import {
  connectDatabase,
  disconnectDatabase,
  getConnectionState,
  pingDatabase,
} from '../config/database.js';
import Shop from '../models/Shop.js';
import Machine from '../models/Machine.js';
import PrintOrder from '../models/PrintOrder.js';
import User from '../models/User.js';
import {
  allocateMachineId,
  buildQrPath,
  findMachineForCustomer,
  registerMachine,
} from '../services/machineService.js';
import logger from '../utils/logger.js';

/**
 * Real MongoDB integration tests.
 *
 * These require a running MongoDB (local mongod, a container, or Atlas) and are
 * SKIPPED — not failed — when none is reachable, so the suite stays green in
 * environments without a database while still proving real behaviour wherever
 * one exists. Run them explicitly with:
 *
 *   npm run test:integration
 *
 * Data hygiene: every run uses a throwaway database name and drops it
 * afterwards, so an accidental run against a shared cluster cannot touch real
 * data. The connection attempt is time-boxed so a dead host costs a couple of
 * seconds, not a couple of minutes.
 */

const TEST_DB = `smartprint_test_${Date.now()}`;
const PROBE_TIMEOUT_MS = 2000;

let connected = false;
let skipReason = '';

before(async () => {
  if (!config.mongo.uri) {
    skipReason = 'MONGODB_URI is not set';
    return;
  }

  // Always write to a throwaway database, never to the one in MONGODB_URI.
  config.mongo.dbName = TEST_DB;

  try {
    await connectDatabase(logger, {
      serverSelectionTimeoutMS: PROBE_TIMEOUT_MS,
      connectTimeoutMS: PROBE_TIMEOUT_MS,
    });
    const ping = await pingDatabase({ timeoutMs: PROBE_TIMEOUT_MS });
    if (!ping.ok) {
      skipReason = `MongoDB unreachable (${ping.error ?? 'ping failed'})`;
      await mongoose.connection.close(false);
      return;
    }
    connected = true;
  } catch (error) {
    skipReason = `MongoDB unreachable (${error.message})`;
  }
});

after(async () => {
  if (!connected) return;
  await mongoose.connection.dropDatabase();
  await disconnectDatabase();
});

/**
 * Skip *at run time* rather than at import time — the connection probe only
 * resolves after the module body has been evaluated.
 */
const it = (name, fn) =>
  test(name, async (t) => {
    if (skipReason) {
      t.skip(`skipped — ${skipReason}`);
      return;
    }
    await fn(t);
  });

describe('database connection', () => {
  it('reports a connected state after connecting', () => {
    const state = getConnectionState();
    assert.equal(state.isConnected, true);
    assert.equal(state.state, 'connected');
  });

  it('resolves a ping with latency', async () => {
    const ping = await pingDatabase();
    assert.equal(ping.ok, true);
    assert.equal(typeof ping.latencyMs, 'number');
  });
});

describe('Shop model', () => {
  it('creates a shop with defaults applied', async () => {
    const shop = await Shop.create({
      shopCode: `SH-${Date.now().toString(36).toUpperCase().slice(-5)}`,
      name: 'Test Digital Press',
      ownerName: 'Test Owner',
      email: `owner${Date.now()}@example.com`,
      phone: '+91 90000 00000',
      address: { city: 'Gurugram', state: 'Haryana' },
    });

    assert.equal(shop.planId, 'starter');
    assert.equal(shop.planStatus, 'trial');
    assert.equal(shop.settings.acceptOrders, true);
    assert.equal(shop.settings.maxUploadMb, 25);
    assert.equal(shop.isAcceptingOrders, true);
  });

  it('rejects a duplicate shopCode', async () => {
    const code = `SH-DUP${Date.now().toString(36).slice(-4).toUpperCase()}`;
    const base = {
      shopCode: code,
      name: 'Dup',
      ownerName: 'Dup',
      phone: '9999999999',
    };
    await Shop.create({ ...base, email: `dup1-${Date.now()}@example.com` });
    await assert.rejects(
      () => Shop.create({ ...base, email: `dup2-${Date.now()}@example.com` }),
      (error) => error.code === 11000,
    );
  });

  it('stops accepting orders when the setting is turned off', async () => {
    const shop = await Shop.create({
      shopCode: `SH-${Date.now().toString(36).toUpperCase().slice(-5)}x`,
      name: 'Paused Press',
      ownerName: 'Owner',
      email: `paused-${Date.now()}@example.com`,
      phone: '9999999998',
      settings: { acceptOrders: false },
    });
    assert.equal(shop.isAcceptingOrders, false);
  });
});

describe('Machine model and ID allocation', () => {
  let shop;

  before(async () => {
    if (!connected) return;
    shop = await Shop.create({
      shopCode: `SH-${Date.now().toString(36).toUpperCase().slice(-5)}m`,
      name: 'Machine Test Shop',
      ownerName: 'Owner',
      email: `machines-${Date.now()}@example.com`,
      phone: '9999999997',
    });
  });

  it('allocates sequential machine IDs', async () => {
    const first = await allocateMachineId();
    assert.match(first, /^SP-\d{3,6}$/);

    await Machine.create({
      machineId: first,
      shopId: shop._id,
      name: 'First',
      qrPath: buildQrPath(first),
    });

    const second = await allocateMachineId();
    assert.notEqual(second, first);
    assert.ok(Number(second.split('-')[1]) > Number(first.split('-')[1]));
  });

  it('registers a machine with a derived QR path and shop linkage', async () => {
    const machine = await registerMachine({
      shopId: shop._id,
      name: 'Counter A',
      printer: { model: 'HP M404dn', supportsColor: false, supportsDuplex: true },
      pricing: { bwSinglePaise: 250, bwDoublePaise: 350 },
    });

    assert.match(machine.machineId, /^SP-\d{3,6}$/);
    assert.equal(machine.qrPath, `/print/${machine.machineId}`);
    assert.equal(machine.status, 'offline');
    assert.equal(machine.printer.supportsDuplex, true);
    assert.equal(machine.pricing.bwSinglePaise, 250);
    // Colour rates are zeroed for a mono printer.
    assert.equal(machine.pricing.colorSinglePaise, 0);
  });

  it('increments the shop machine counter on registration', async () => {
    const before = await Shop.findById(shop._id).select('machineCount').lean();
    await registerMachine({ shopId: shop._id, name: 'Counter B' });
    const after = await Shop.findById(shop._id).select('machineCount').lean();
    assert.equal(after.machineCount, before.machineCount + 1);
  });

  it('rejects a machine not linked to any shop', async () => {
    await assert.rejects(
      () => Machine.create({ machineId: 'SP-900', name: 'Orphan', qrPath: '/print/SP-900' }),
      /must be registered to a shop/i,
    );
  });

  it('rejects a duplicate machine ID — one QR, one printer', async () => {
    const existing = await Machine.findOne({ shopId: shop._id }).lean();
    await assert.rejects(
      () =>
        Machine.create({
          machineId: existing.machineId,
          shopId: shop._id,
          name: 'Clone',
          qrPath: existing.qrPath,
        }),
      (error) => error.code === 11000,
    );
  });

  it('rejects a malformed machine ID at the schema level', async () => {
    await assert.rejects(
      () =>
        Machine.create({
          machineId: 'NOT-A-MACHINE',
          shopId: shop._id,
          name: 'Bad',
          qrPath: '/print/x',
        }),
      /Machine ID must look like SP-001/,
    );
  });

  it('resolves a QR scan to the machine and its shop context', async () => {
    const created = await registerMachine({ shopId: shop._id, name: 'QR Target' });
    const resolved = await findMachineForCustomer(created.machineId.toLowerCase());

    assert.equal(resolved.machineId, created.machineId);
    assert.equal(resolved.shopId.name, 'Machine Test Shop');
    assert.equal(resolved.qrPath, `/print/${created.machineId}`);
  });

  it('throws a 404 for an unknown machine ID', async () => {
    await assert.rejects(
      () => findMachineForCustomer('SP-999999'),
      (error) => error.statusCode === 404 && error.code === 'MACHINE_NOT_FOUND',
    );
  });
});

describe('User model', () => {
  it('requires a shopId for shop accounts', async () => {
    await assert.rejects(
      () =>
        User.create({
          name: 'No Shop',
          email: `noscope-${Date.now()}@example.com`,
          role: 'shop',
        }),
      /must be linked to a shopId/,
    );
  });

  it('forbids a shopId on admin accounts', async () => {
    await assert.rejects(
      () =>
        User.create({
          name: 'Bad Admin',
          email: `badadmin-${Date.now()}@example.com`,
          role: 'admin',
          shopId: new mongoose.Types.ObjectId(),
        }),
      /must not be linked to a shopId/,
    );
  });

  it('creates a valid admin without a shop', async () => {
    const admin = await User.create({
      name: 'Platform Admin',
      email: `admin-${Date.now()}@example.com`,
      role: 'admin',
    });
    assert.equal(admin.role, 'admin');
    assert.equal(admin.shopId, null);
  });

  it('never returns passwordHash by default', async () => {
    const created = await User.create({
      name: 'Hash Test',
      email: `hash-${Date.now()}@example.com`,
      role: 'admin',
    });
    await User.updateOne({ _id: created._id }, { $set: { passwordHash: 'should-not-leak' } });

    const fetched = await User.findById(created._id);
    assert.equal(fetched.passwordHash, undefined);
    assert.equal(JSON.parse(JSON.stringify(fetched)).passwordHash, undefined);
  });
});

describe('PrintOrder model', () => {
  let shop;
  let machine;

  before(async () => {
    if (!connected) return;
    shop = await Shop.create({
      shopCode: `SH-${Date.now().toString(36).toUpperCase().slice(-5)}o`,
      name: 'Order Test Shop',
      ownerName: 'Owner',
      email: `orders-${Date.now()}@example.com`,
      phone: '9999999996',
      planId: 'growth',
    });
    machine = await registerMachine({ shopId: shop._id, name: 'Order Machine' });
  });

  const validOrder = () => ({
    orderCode: `SPO-${Date.now()}${Math.floor(Math.random() * 1000)}`,
    shopId: shop._id,
    machineId: machine.machineId,
    machineRef: machine._id,
    documents: [{ documentName: 'notes.pdf', pageCount: 10, copies: 1, sides: 'single' }],
    totals: { subtotalPaise: 2000, platformFeePaise: 70, totalPaise: 2000 },
  });

  it('creates an order defaulting to draft with pending payment', async () => {
    const order = await PrintOrder.create(validOrder());
    assert.equal(order.status, 'draft');
    assert.equal(order.payment.status, 'pending');
    assert.equal(order.isPaid, false);
  });

  it('records a status timeline via addEvent', async () => {
    const order = await PrintOrder.create(validOrder());
    order.addEvent('queued', { actor: 'system', note: 'Handed to agent' });
    order.status = 'queued';
    await order.save();

    const reloaded = await PrintOrder.findById(order._id);
    assert.equal(reloaded.timeline.length, 1);
    assert.equal(reloaded.timeline[0].status, 'queued');
    assert.equal(reloaded.timeline[0].actor, 'system');
  });

  it('refuses an order with no documents', async () => {
    await assert.rejects(
      () => PrintOrder.create({ ...validOrder(), documents: [] }),
      /between 1 and 5/,
    );
  });

  it('refuses an order with more than five documents', async () => {
    const documents = Array.from({ length: 6 }, (_, i) => ({
      documentName: `doc${i}.pdf`,
      pageCount: 1,
    }));
    await assert.rejects(
      () => PrintOrder.create({ ...validOrder(), documents }),
      /between 1 and 5/,
    );
  });

  it('has no "success" payment state — paid requires a verified transition', async () => {
    const enumValues = PrintOrder.schema.path('payment.status').enumValues;
    assert.ok(!enumValues.includes('success'), 'payment must not expose a "success" state');
    assert.deepEqual(enumValues.sort(), ['failed', 'not_required', 'pending', 'refunded']);
  });

  it('carries denormalised shop and machine identifiers for reporting', async () => {
    const order = await PrintOrder.create(validOrder());
    assert.equal(String(order.shopId), String(shop._id));
    assert.equal(order.machineId, machine.machineId);
  });
});
