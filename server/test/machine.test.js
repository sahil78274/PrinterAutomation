import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildQrPath,
  formatMachineId,
  getAcceptanceBlocker,
  isValidMachineId,
  parseMachineId,
} from '../services/machineService.js';
import { validateMachineIdParam, validateRegisterMachine } from '../validators/machineValidator.js';
import { validateCreateShop } from '../validators/shopValidator.js';
import { parsePagination } from '../validators/common.js';

/**
 * Machine identity is the contract the whole product rests on: the QR sticker
 * must resolve to exactly one printer forever. These tests pin that behaviour.
 */

describe('machine ID formatting', () => {
  test('pads sequence numbers to three digits', () => {
    assert.equal(formatMachineId(1), 'SP-001');
    assert.equal(formatMachineId(42), 'SP-042');
    assert.equal(formatMachineId(999), 'SP-999');
  });

  test('grows beyond three digits without truncation', () => {
    assert.equal(formatMachineId(1000), 'SP-1000');
    assert.equal(formatMachineId(123456), 'SP-123456');
  });
});

describe('machine ID parsing', () => {
  test('normalises case and padding', () => {
    assert.deepEqual(parseMachineId('sp-1'), { normalised: 'SP-001', sequence: 1 });
    assert.deepEqual(parseMachineId('SP-007'), { normalised: 'SP-007', sequence: 7 });
  });

  test('tolerates surrounding whitespace', () => {
    assert.deepEqual(parseMachineId('  SP-012  '), { normalised: 'SP-012', sequence: 12 });
  });

  test('rejects malformed identifiers', () => {
    for (const bad of [
      'SP-',
      'SP-abc',
      'SP-1-2',
      'XX-001',
      '001',
      '',
      null,
      undefined,
      'SP-1234567',
    ]) {
      assert.equal(parseMachineId(bad), null, `expected ${JSON.stringify(bad)} to be rejected`);
    }
  });

  test('isValidMachineId agrees with parseMachineId', () => {
    assert.equal(isValidMachineId('SP-001'), true);
    assert.equal(isValidMachineId('SP-ABC'), false);
  });
});

describe('QR path', () => {
  test('is always derived from the machine ID', () => {
    assert.equal(buildQrPath('SP-001'), '/print/SP-001');
    assert.equal(buildQrPath('sp-004'), '/print/SP-004');
  });

  test('canonicalises so a QR can never point at the wrong casing', () => {
    assert.equal(buildQrPath('sp-010'), buildQrPath('SP-010'));
  });
});

describe('acceptance rules', () => {
  const base = {
    status: 'online',
    shopId: { status: 'active', settings: { acceptOrders: true }, planStatus: 'active' },
  };

  test('allows an online machine in an accepting shop', () => {
    assert.equal(getAcceptanceBlocker(base), null);
  });

  test('blocks an offline machine', () => {
    assert.match(getAcceptanceBlocker({ ...base, status: 'offline' }), /offline/i);
  });

  test('blocks a machine under maintenance', () => {
    assert.match(getAcceptanceBlocker({ ...base, status: 'maintenance' }), /maintenance/i);
  });

  test('blocks when the shop has paused orders', () => {
    const machine = { ...base, shopId: { ...base.shopId, settings: { acceptOrders: false } } };
    assert.match(getAcceptanceBlocker(machine), /paused/i);
  });

  test('blocks when the shop itself is not active', () => {
    const machine = { ...base, shopId: { ...base.shopId, status: 'suspended' } };
    assert.match(getAcceptanceBlocker(machine), /not accepting/i);
  });

  test('blocks a cancelled subscription', () => {
    const machine = { ...base, shopId: { ...base.shopId, planStatus: 'cancelled' } };
    assert.match(getAcceptanceBlocker(machine), /not accepting/i);
  });
});

describe('validateMachineIdParam', () => {
  test('accepts a valid ID and uppercases it', () => {
    const { value, errors } = validateMachineIdParam({ machineId: 'sp-003' });
    assert.deepEqual(errors, {});
    assert.equal(value.machineId, 'SP-003');
  });

  test('rejects traversal attempts and junk', () => {
    for (const bad of ['../../etc/passwd', 'SP-1;DROP', '<script>', '']) {
      const { errors } = validateMachineIdParam({ machineId: bad });
      assert.ok(errors.machineId, `expected ${JSON.stringify(bad)} to be rejected`);
    }
  });
});

describe('validateRegisterMachine', () => {
  const validShopId = '507f1f77bcf86cd799439011';

  test('accepts a minimal valid payload', () => {
    const { value, errors } = validateRegisterMachine({ shopId: validShopId, name: 'Counter A' });
    assert.deepEqual(errors, {});
    assert.equal(value.name, 'Counter A');
    assert.equal(value.printer.maxPaperSize, 'A4');
    assert.equal(value.printer.supportsColor, false);
  });

  test('ignores client-supplied machineId, qrPath and status', () => {
    const { value } = validateRegisterMachine({
      shopId: validShopId,
      name: 'Counter B',
      machineId: 'SP-999',
      qrPath: '/print/HACKED',
      status: 'online',
    });
    // None of these may survive validation — they are server-controlled.
    assert.equal(value.machineId, undefined);
    assert.equal(value.qrPath, undefined);
    assert.equal(value.status, undefined);
  });

  test('requires a name and a valid shop id', () => {
    const { errors } = validateRegisterMachine({ shopId: 'not-an-object-id' });
    assert.ok(errors.shopId);
    assert.ok(errors.name);
  });

  test('rejects non-integer money values', () => {
    const { errors } = validateRegisterMachine({
      shopId: validShopId,
      name: 'X',
      pricing: { bwSinglePaise: 1.5 },
    });
    assert.ok(errors['pricing.bwSinglePaise']);
  });

  test('rejects negative prices', () => {
    const { errors } = validateRegisterMachine({
      shopId: validShopId,
      name: 'X',
      pricing: { bwSinglePaise: -100 },
    });
    assert.ok(errors['pricing.bwSinglePaise']);
  });

  test('rejects an unknown paper size and falls back to A4', () => {
    const { value } = validateRegisterMachine({
      shopId: validShopId,
      name: 'X',
      printer: { maxPaperSize: 'A0', paperSizes: ['A0', 'A4'] },
    });
    assert.equal(value.printer.maxPaperSize, 'A4');
    assert.deepEqual(value.printer.paperSizes, ['A4']);
  });
});

describe('validateCreateShop', () => {
  const valid = {
    name: 'Sharma Digital Press',
    ownerName: 'Rohit Sharma',
    email: 'owner@example.com',
    phone: '+91 98110 45231',
  };

  test('accepts a valid shop', () => {
    const { value, errors } = validateCreateShop(valid);
    assert.deepEqual(errors, {});
    assert.equal(value.email, 'owner@example.com');
  });

  test('rejects a malformed email', () => {
    const { errors } = validateCreateShop({ ...valid, email: 'not-an-email' });
    assert.ok(errors.email);
  });

  test('rejects a malformed GSTIN', () => {
    const { errors } = validateCreateShop({ ...valid, gstin: '123' });
    assert.ok(errors.gstin);
  });

  test('uppercases a valid GSTIN', () => {
    const { value } = validateCreateShop({ ...valid, gstin: '06aabcs1429p1zq' });
    assert.equal(value.gstin, '06AABCS1429P1ZQ');
  });

  test('rejects an unknown plan', () => {
    const { errors } = validateCreateShop({ ...valid, planId: 'enterprise' });
    assert.ok(errors.planId);
  });
});

describe('parsePagination', () => {
  test('applies safe defaults', () => {
    assert.deepEqual(parsePagination({}), { page: 1, limit: 20 });
  });

  test('clamps abusive values', () => {
    assert.equal(parsePagination({ limit: 100000 }).limit, 100);
    assert.equal(parsePagination({ page: -5 }).page, 1);
  });

  test('ignores non-numeric input', () => {
    assert.deepEqual(parsePagination({ page: 'abc', limit: 'xyz' }), { page: 1, limit: 20 });
  });
});
