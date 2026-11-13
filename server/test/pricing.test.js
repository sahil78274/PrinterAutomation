import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  PLATFORM_FEE_BPS,
  bpsToMultiplier,
  priceDocument,
  priceOrder,
  sheetsForPages,
} from '../services/pricingService.js';

/**
 * The pricing engine decides what a customer is charged, so it gets thorough
 * coverage: page math, duplex billing, surcharges, minimums and commission.
 */

const pricing = {
  bwSinglePaise: 200, // ₹2.00
  bwDoublePaise: 300, // ₹3.00 per duplex sheet
  colorSinglePaise: 800,
  colorDoublePaise: 1400,
  a3SurchargeBps: 16_000, // ×1.6
  minimumChargePaise: 500, // ₹5.00
};

describe('sheetsForPages', () => {
  test('single-sided uses one sheet per page', () => {
    assert.equal(sheetsForPages(10, 'single'), 10);
  });

  test('double-sided halves the sheet count', () => {
    assert.equal(sheetsForPages(10, 'double'), 5);
  });

  test('double-sided rounds odd page counts up', () => {
    assert.equal(sheetsForPages(11, 'double'), 6);
    assert.equal(sheetsForPages(1, 'double'), 1);
  });

  test('zero pages yields zero sheets', () => {
    assert.equal(sheetsForPages(0, 'double'), 0);
  });
});

describe('bpsToMultiplier', () => {
  test('converts basis points to a multiplier', () => {
    assert.equal(bpsToMultiplier(16_000), 2.6); // 100% + 160%
    assert.equal(bpsToMultiplier(0), 1);
  });
});

describe('priceDocument', () => {
  test('bills single-sided per page', () => {
    const result = priceDocument({ pageCount: 10, sides: 'single' }, pricing);
    assert.equal(result.billableUnits, 10);
    assert.equal(result.unitPricePaise, 200);
    assert.equal(result.lineTotalPaise, 2000); // ₹20
  });

  test('bills double-sided per sheet, never per side', () => {
    const single = priceDocument({ pageCount: 10, sides: 'single' }, pricing);
    const double = priceDocument({ pageCount: 10, sides: 'double' }, pricing);

    assert.equal(double.billableUnits, 5);
    assert.equal(double.unitPricePaise, 300);
    assert.equal(double.lineTotalPaise, 1500); // 5 sheets × ₹3
    // The core guarantee: duplex is cheaper than two single-sided runs.
    assert.ok(double.lineTotalPaise < single.lineTotalPaise);
  });

  test('multiplies by copies', () => {
    const result = priceDocument({ pageCount: 5, copies: 3, sides: 'single' }, pricing);
    assert.equal(result.lineTotalPaise, 5 * 3 * 200);
  });

  test('applies the A3 surcharge to the unit price, rounded to paise', () => {
    const a4 = priceDocument({ pageCount: 1, paperSize: 'A4' }, pricing);
    const a3 = priceDocument({ pageCount: 1, paperSize: 'A3' }, pricing);
    assert.equal(a4.unitPricePaise, 200);
    assert.equal(a3.unitPricePaise, 520); // 200 × 2.6
  });

  test('prices colour from the colour rate', () => {
    const result = priceDocument({ pageCount: 3, color: true, sides: 'single' }, pricing);
    assert.equal(result.unitPricePaise, 800);
    assert.equal(result.lineTotalPaise, 2400);
  });

  test('rejects colour on a mono machine instead of silently pricing ₹0', () => {
    const mono = { ...pricing, colorSinglePaise: 0, colorDoublePaise: 0 };
    assert.throws(
      () => priceDocument({ pageCount: 1, color: true }, mono),
      (error) =>
        error.code === 'COLOR_UNSUPPORTED' ||
        /Colour printing is not available/.test(error.message),
    );
  });

  test('rejects an empty document', () => {
    assert.throws(() => priceDocument({ pageCount: 0 }, pricing), /at least one page/);
  });

  test('rejects an unsupported paper size', () => {
    assert.throws(
      () => priceDocument({ pageCount: 1, paperSize: 'A0' }, pricing),
      /Unsupported paper/,
    );
  });

  test('clamps copies into the allowed range', () => {
    const tooMany = priceDocument({ pageCount: 1, copies: 500 }, pricing);
    assert.equal(tooMany.copies, 99);
    const tooFew = priceDocument({ pageCount: 1, copies: 0 }, pricing);
    assert.equal(tooFew.copies, 1);
  });

  test('throws a clear internal error when pricing config is missing', () => {
    assert.throws(() => priceDocument({ pageCount: 1 }, null), /pricing configuration is missing/);
  });
});

describe('priceOrder', () => {
  test('sums multiple documents', () => {
    const result = priceOrder({
      documents: [
        { documentName: 'a.pdf', pageCount: 10, sides: 'single' },
        { documentName: 'b.pdf', pageCount: 10, sides: 'double' },
      ],
      pricing,
    });
    assert.equal(result.lines.length, 2);
    assert.equal(result.subtotalPaise, 2000 + 1500);
    assert.equal(result.totalPaise, 3500);
  });

  test('tops a small order up to the minimum charge', () => {
    const result = priceOrder({
      documents: [{ documentName: 'tiny.pdf', pageCount: 1, sides: 'single' }],
      pricing,
    });
    assert.equal(result.subtotalPaise, 500); // raised from 200
    assert.equal(result.minimumTopUpPaise, 300);
  });

  test('does not apply the minimum to orders already above it', () => {
    const result = priceOrder({
      documents: [{ documentName: 'big.pdf', pageCount: 50, sides: 'single' }],
      pricing,
    });
    assert.equal(result.minimumTopUpPaise, 0);
  });

  test('computes the platform fee from the shop plan', () => {
    const documents = [{ documentName: 'a.pdf', pageCount: 100, sides: 'single' }];
    const starter = priceOrder({ documents, pricing, planId: 'starter' });
    const scale = priceOrder({ documents, pricing, planId: 'scale' });

    assert.equal(starter.platformFeeBps, PLATFORM_FEE_BPS.starter);
    assert.equal(starter.platformFeePaise, Math.round((20_000 * 600) / 10_000));
    assert.ok(scale.platformFeePaise < starter.platformFeePaise);
  });

  test('shop earning equals total minus platform fee', () => {
    const result = priceOrder({
      documents: [{ documentName: 'a.pdf', pageCount: 40, sides: 'single' }],
      pricing,
      planId: 'growth',
    });
    assert.equal(result.shopEarningPaise, result.totalPaise - result.platformFeePaise);
  });

  test('customer pays the subtotal, not the subtotal plus fee', () => {
    const result = priceOrder({
      documents: [{ documentName: 'a.pdf', pageCount: 10 }],
      pricing,
    });
    assert.equal(result.totalPaise, result.subtotalPaise);
  });

  test('rejects an order with no documents', () => {
    assert.throws(() => priceOrder({ documents: [], pricing }), /at least one document/);
  });

  test('is deterministic — the same input always yields the same total', () => {
    const input = {
      documents: [
        { documentName: 'a.pdf', pageCount: 17, copies: 2, sides: 'double', color: true },
      ],
      pricing,
      planId: 'growth',
    };
    assert.deepEqual(priceOrder(input), priceOrder(input));
  });
});
