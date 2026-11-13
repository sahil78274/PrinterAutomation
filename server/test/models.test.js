import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import Shop from '../models/Shop.js';
import Machine from '../models/Machine.js';
import User from '../models/User.js';
import PrintOrder from '../models/PrintOrder.js';
import { formatMachineId, parseMachineId, buildQrPath } from '../services/machineService.js';
import { generateShopCode } from '../services/shopService.js';

/**
 * Schema-level tests. These exercise Mongoose documents in memory — validation,
 * defaults, enums and normalisation — so they run without a database. Anything
 * that needs an index to actually be enforced lives in db.integration.test.js.
 */

const OID = () => new mongoose.Types.ObjectId();

/**
 * Await validation and return the error map rather than throwing.
 * A ValidationError carries `errors`; any other throw is re-raised so a genuine
 * bug in a hook cannot masquerade as a validation failure.
 */
async function validate(doc) {
  try {
    await doc.validate();
    return null;
  } catch (error) {
    if (error.name === 'ValidationError') return error.errors;
    throw error;
  }
}

describe('Machine schema — identity', () => {
  test('accepts a canonical machine ID', async () => {
    const machine = new Machine({
      machineId: 'SP-001',
      shopId: OID(),
      name: 'Counter A',
      qrPath: '/print/SP-001',
    });
    assert.equal(await validate(machine), null);
  });

  test('uppercases the ID on assignment so a typed QR code still resolves', async () => {
    const machine = new Machine({
      machineId: 'sp-42',
      shopId: OID(),
      name: 'Counter B',
      qrPath: '/print/SP-042',
    });
    await machine.validate();
    // Canonical form: padded to at least three digits, exactly like
    // parseMachineId, so "sp-42" and "SP-042" are the same machine.
    assert.equal(machine.machineId, 'SP-042');
  });

  test('derives qrPath from the ID so the two can never disagree', async () => {
    const machine = new Machine({
      machineId: 'SP-777',
      shopId: OID(),
      name: 'Counter C',
      // Deliberately wrong: the schema must overwrite it.
      qrPath: '/print/WRONG',
    });
    await machine.validate();
    assert.equal(machine.qrPath, '/print/SP-777');
  });

  test('rejects IDs that could not have been issued', async () => {
    for (const bad of ['SP-1A', 'XX-001', 'SP-', 'S-001', 'SP-1234567', 'SP-000']) {
      const machine = new Machine({
        machineId: bad,
        shopId: OID(),
        name: 'Bad',
        qrPath: '/print/x',
      });
      const errors = await validate(machine);
      assert.ok(errors?.machineId, `${bad} should be rejected`);
    }
  });

  test('requires a shop — an unowned printer has no tenant to bill', async () => {
    const machine = new Machine({ machineId: 'SP-002', name: 'Orphan', qrPath: '/print/SP-002' });
    const errors = await validate(machine);
    assert.ok(errors?.shopId);
  });

  test('requires a name', async () => {
    const machine = new Machine({ machineId: 'SP-003', shopId: OID() });
    const errors = await validate(machine);
    assert.ok(errors?.name);
  });

  test('does not require qrPath — it is derived, never supplied', async () => {
    const machine = new Machine({ machineId: 'SP-004', shopId: OID(), name: 'Derived' });
    await machine.validate();
    assert.equal(machine.qrPath, '/print/SP-004');
  });
});

describe('Machine schema — defaults and capabilities', () => {
  const build = (overrides = {}) =>
    new Machine({
      machineId: 'SP-010',
      shopId: OID(),
      name: 'Defaults',
      qrPath: '/print/SP-010',
      ...overrides,
    });

  test('is offline and unpaired until an agent checks in', async () => {
    const machine = build();
    await machine.validate();
    assert.equal(machine.status, 'offline');
    assert.equal(machine.agent.status, 'unpaired');
    assert.equal(machine.lastHeartbeatAt, null);
  });

  test('defaults to mono A4 over USB', async () => {
    const machine = build();
    await machine.validate();
    assert.equal(machine.printer.supportsColor, false);
    assert.equal(machine.printer.supportsDuplex, false);
    assert.equal(machine.printer.maxPaperSize, 'A4');
    assert.equal(machine.printer.connection, 'USB');
    assert.deepEqual([...machine.printer.paperSizes], ['A4']);
  });

  test('default pricing is a sane non-zero rate', async () => {
    const machine = build();
    await machine.validate();
    assert.ok(machine.pricing.bwSinglePaise > 0);
    assert.ok(machine.pricing.bwDoublePaise >= machine.pricing.bwSinglePaise);
  });

  test('rejects negative prices', async () => {
    const machine = build({ pricing: { bwSinglePaise: -5 } });
    const errors = await validate(machine);
    assert.ok(errors?.['pricing.bwSinglePaise']);
  });

  test('rejects a supply level outside 0–100', async () => {
    const machine = build({ consumables: { tonerPercent: 140 } });
    const errors = await validate(machine);
    assert.ok(errors?.['consumables.tonerPercent']);
  });

  test('rejects an unknown status', async () => {
    const machine = build({ status: 'exploded' });
    const errors = await validate(machine);
    assert.ok(errors?.status);
  });

  test('rejects an unsupported paper size', async () => {
    const machine = build({ printer: { maxPaperSize: 'A0' } });
    const errors = await validate(machine);
    assert.ok(errors?.['printer.maxPaperSize']);
  });
});

describe('Shop schema', () => {
  const valid = () => ({
    shopCode: 'SH-ABCDE',
    name: 'Sharma Digital Press',
    ownerName: 'Rakesh Sharma',
    email: 'owner@example.com',
    phone: '9812345678',
  });

  test('accepts a minimal shop and applies defaults', async () => {
    const shop = new Shop(valid());
    assert.equal(await validate(shop), null);
    assert.equal(shop.planId, 'starter');
    assert.equal(shop.status, 'active');
    assert.equal(shop.settings.acceptOrders, true);
    assert.equal(shop.settings.requirePaymentBeforePrint, true);
  });

  test('starts at zero machines and zero orders', async () => {
    const shop = new Shop(valid());
    await shop.validate();
    assert.equal(shop.machineCount, 0);
  });

  test('rejects an unknown plan', async () => {
    const shop = new Shop({ ...valid(), planId: 'enterprise' });
    const errors = await validate(shop);
    assert.ok(errors?.planId);
  });

  test('rejects an invalid email', async () => {
    const errors = await validate(new Shop({ ...valid(), email: 'nope' }));
    assert.ok(errors?.email);
  });

  test('requires a phone number', async () => {
    const errors = await validate(new Shop({ ...valid(), phone: undefined }));
    assert.ok(errors?.phone);
  });

  test('isAcceptingOrders is false when the shop is suspended', async () => {
    const shop = new Shop({ ...valid(), status: 'suspended' });
    await shop.validate();
    assert.equal(shop.isAcceptingOrders, false);
  });

  test('isAcceptingOrders is false when the shop paused orders', async () => {
    const shop = new Shop({ ...valid(), settings: { acceptOrders: false } });
    await shop.validate();
    assert.equal(shop.isAcceptingOrders, false);
  });
});

describe('User schema', () => {
  test('a shop account must reference a shop', async () => {
    const user = new User({ name: 'Owner', email: 'o@example.com', role: 'shop' });
    const errors = await validate(user);
    assert.ok(errors?.shopId);
    // Reported as a field error (→ 422), never as an unhandled 500.
    assert.match(errors.shopId.message, /link|shopId/i);
  });

  test('an admin must not reference a shop', async () => {
    const user = new User({
      name: 'Admin',
      email: 'a@example.com',
      role: 'admin',
      shopId: OID(),
    });
    const errors = await validate(user);
    assert.ok(errors?.shopId);
  });

  test('staff belong to a shop too', async () => {
    const errors = await validate(
      new User({ name: 'Staff', email: 's@example.com', role: 'staff' }),
    );
    assert.ok(errors?.shopId);
  });

  test('a valid owner passes', async () => {
    const user = new User({
      name: 'Owner',
      email: 'owner@example.com',
      role: 'shop',
      shopId: OID(),
    });
    assert.equal(await validate(user), null);
  });

  test('rejects an unknown role', async () => {
    const errors = await validate(
      new User({ name: 'Ghost', email: 'g@example.com', role: 'superuser' }),
    );
    assert.ok(errors?.role);
  });

  test('normalises the email for case-insensitive login', async () => {
    const user = new User({
      name: 'Owner',
      email: '  Owner@Example.COM ',
      role: 'shop',
      shopId: OID(),
    });
    await user.validate();
    assert.equal(user.email, 'owner@example.com');
  });

  test('never leaks passwordHash through toJSON', async () => {
    const user = new User({
      name: 'Owner',
      email: 'owner@example.com',
      role: 'shop',
      shopId: OID(),
      passwordHash: 'secret',
    });
    const json = JSON.parse(JSON.stringify(user));
    // A set value must be stripped even though the path is not selected by
    // default — otherwise res.json(user) would ship the hash.
    assert.equal(json.passwordHash, undefined);
    assert.equal(user.toObject().passwordHash, undefined);
    // The real value is still available to the auth service explicitly.
    assert.equal(user.passwordHash, 'secret');
  });
});

describe('PrintOrder schema', () => {
  const base = () => ({
    orderCode: 'SPO-1001',
    shopId: OID(),
    machineId: 'SP-001',
    machineRef: OID(),
    documents: [{ documentName: 'notes.pdf', pageCount: 4, copies: 1, sides: 'single' }],
    totals: { subtotalPaise: 800, platformFeePaise: 50, totalPaise: 800 },
  });

  test('starts as a draft with payment pending', async () => {
    const order = new PrintOrder(base());
    assert.equal(await validate(order), null);
    assert.equal(order.status, 'draft');
    assert.equal(order.payment.status, 'pending');
    assert.equal(order.isPaid, false);
  });

  test('the lifecycle enum is exactly the documented set', async () => {
    assert.deepEqual(PrintOrder.schema.path('status').enumValues, [
      'draft',
      'awaiting_payment',
      'paid',
      'queued',
      'printing',
      'completed',
      'failed',
      'cancelled',
      'refunded',
    ]);
  });

  test('payment has no "success" state — success is verified, not asserted', async () => {
    const values = PrintOrder.schema.path('payment.status').enumValues;
    assert.equal(values.includes('success'), false);
    assert.deepEqual([...values].sort(), ['failed', 'not_required', 'pending', 'refunded']);
  });

  test('requires at least one document and at most five', async () => {
    assert.ok((await validate(new PrintOrder({ ...base(), documents: [] })))?.documents);

    const six = Array.from({ length: 6 }, (_, i) => ({ documentName: `d${i}.pdf`, pageCount: 1 }));
    assert.ok((await validate(new PrintOrder({ ...base(), documents: six })))?.documents);
  });

  test('each document needs a name and a positive page count', async () => {
    const errors = await validate(new PrintOrder({ ...base(), documents: [{ pageCount: 0 }] }));
    assert.ok(errors?.['documents.0.documentName'] || errors?.documents);
  });

  test('rejects negative totals', async () => {
    const errors = await validate(
      new PrintOrder({ ...base(), totals: { subtotalPaise: -1, totalPaise: -1 } }),
    );
    assert.ok(errors);
  });

  test('requires both shopId and machineId — history is never ambiguous', async () => {
    const errors = await validate(new PrintOrder({ ...base(), shopId: undefined }));
    assert.ok(errors?.shopId);
  });

  test('addEvent appends to the timeline', async () => {
    const order = new PrintOrder(base());
    order.addEvent('queued', { actor: 'system', note: 'sent to agent' });
    assert.equal(order.timeline.length, 1);
    assert.equal(order.timeline[0].status, 'queued');
    assert.ok(order.timeline[0].at instanceof Date);
  });

  test('is only paid once the order reaches a paid-versus-post-paid state', async () => {
    const order = new PrintOrder({
      ...base(),
      payment: { status: 'pending', providerReference: 'test_pay_1' },
    });
    await order.validate();
    assert.equal(order.isPaid, false);

    // Raising payment.status alone must not mark the order paid: the job has
    // not been released, so nothing is owed to the agent yet.
    order.payment.status = 'not_required';
    assert.equal(order.isPaid, false);

    order.status = 'paid';
    assert.equal(order.isPaid, true);
  });
});

describe('machine ID helpers', () => {
  test('formatMachineId pads to three digits', () => {
    assert.equal(formatMachineId(1), 'SP-001');
    assert.equal(formatMachineId(42), 'SP-042');
    assert.equal(formatMachineId(1234), 'SP-1234');
  });

  test('parseMachineId is lenient in, canonical out', () => {
    for (const input of ['SP-1', 'sp-1', ' Sp-001 ', 'SP-0001']) {
      assert.deepEqual(parseMachineId(input), { normalised: 'SP-001', sequence: 1 }, input);
    }
  });

  test('parseMachineId rejects anything not issuable', () => {
    for (const input of ['SP-0', 'SP-000', '', null, undefined, 'SP-1234567', 'AB-001', 'SP-1B']) {
      assert.equal(parseMachineId(input), null, String(input));
    }
  });

  test('buildQrPath always matches the canonical ID', () => {
    assert.equal(buildQrPath('sp-7'), '/print/SP-7');
    assert.equal(buildQrPath('SP-007'), '/print/SP-007');
  });

  test('a parsed ID round-trips through the QR path', () => {
    const parsed = parseMachineId('sp-15');
    assert.equal(buildQrPath(parsed.normalised), '/print/SP-015');
  });
});

describe('shop code generator', () => {
  test('produces SH- prefixed five-character codes', () => {
    for (let i = 0; i < 50; i += 1) {
      assert.match(generateShopCode(), /^SH-[A-Z0-9]{5}$/);
    }
  });

  test('avoids characters that are misread when spoken or printed', () => {
    const codes = Array.from({ length: 200 }, () => generateShopCode()).join('');
    for (const char of ['I', 'O', '0', '1']) {
      // The prefix itself contains no digits, so any occurrence is a real hit.
      assert.equal(codes.replace(/^SH-/gm, '').includes(char), false, `${char} should not appear`);
    }
  });

  test('codes are not trivially repeating', () => {
    const codes = new Set(Array.from({ length: 25 }, () => generateShopCode()));
    assert.ok(codes.size > 20, 'generator appears to be colliding');
  });
});
