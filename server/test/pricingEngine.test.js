import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  countSheets,
  formatPaise,
  normalisePrintRequest,
  parsePageRanges,
  quote,
} from '../services/pricingEngine.js';

/**
 * Pricing engine tests.
 *
 * Money maths is the part of a printing business where a bug is immediately
 * visible to customers, so these assert exact paise values rather than ranges.
 */

/** A mono, duplex-capable machine on default rates. */
const monoMachine = {
  printer: { supportsColor: false, supportsDuplex: true },
  pricing: {
    bwSinglePaise: 200,
    bwDoublePaise: 300,
    colorSinglePaise: 800,
    colorDoublePaise: 1400,
    a3SurchargeBps: 16_000,
    minimumChargePaise: 0,
  },
};

const colorMachine = {
  printer: { supportsColor: true, supportsDuplex: true },
  pricing: { ...monoMachine.pricing },
};

const request = (overrides = {}) => ({
  pageCount: 10,
  copies: 1,
  color: 'bw',
  sides: 'single',
  paperSize: 'A4',
  ...overrides,
});

describe('page range parsing', () => {
  test('an empty selection means the whole document', () => {
    assert.equal(parsePageRanges('', 5), null);
    assert.equal(parsePageRanges(undefined, 5), null);
  });

  test('parses single pages, ranges and mixtures', () => {
    assert.deepEqual(parsePageRanges('1,3,7', 10), [1, 3, 7]);
    assert.deepEqual(parsePageRanges('2-4', 10), [2, 3, 4]);
    assert.deepEqual(parsePageRanges('1-3,7,9-10', 10), [1, 2, 3, 7, 9, 10]);
  });

  test('de-duplicates so overlapping ranges are not billed twice', () => {
    assert.deepEqual(parsePageRanges('1-5,3-7', 10), [1, 2, 3, 4, 5, 6, 7]);
    assert.deepEqual(parsePageRanges('3,3,3', 10), [3]);
  });

  test('sorts so input order does not matter', () => {
    assert.deepEqual(parsePageRanges('9,1,5', 10), [1, 5, 9]);
  });

  test('rejects pages beyond the document', () => {
    assert.throws(() => parsePageRanges('11', 10), /does not exist/);
    assert.throws(() => parsePageRanges('8-12', 10), /outside this document/);
  });

  test('rejects backwards ranges with a helpful message', () => {
    assert.throws(() => parsePageRanges('5-2', 10), /backwards/);
  });

  test('rejects nonsense', () => {
    assert.throws(() => parsePageRanges('zero', 10), /not a page number/);
    assert.throws(() => parsePageRanges('0', 10), /not a page number/);
    assert.throws(() => parsePageRanges('-3', 10));
  });
});

describe('sheet counting', () => {
  test('single-sided uses one sheet per page', () => {
    const result = countSheets({ printedPages: 10, sides: 'single', copies: 1 });
    assert.equal(result.totalSheets, 10);
    assert.equal(result.singleSheets, 10);
    assert.equal(result.duplexSheets, 0);
  });

  test('duplex halves the sheet count', () => {
    const result = countSheets({ printedPages: 10, sides: 'double', copies: 1 });
    assert.equal(result.totalSheets, 5);
    assert.equal(result.duplexSheets, 5);
    assert.equal(result.singleSheets, 0);
  });

  test('an odd duplex job bills the blank-back sheet as single-sided', () => {
    // 7 pages duplex = 3 full sheets + 1 sheet with a blank back.
    const result = countSheets({ printedPages: 7, sides: 'double', copies: 1 });
    assert.equal(result.duplexSheets, 3);
    assert.equal(result.singleSheets, 1);
    assert.equal(result.totalSheets, 4);
  });

  test('a single page duplex is really a single-sided sheet', () => {
    const result = countSheets({ printedPages: 1, sides: 'double', copies: 1 });
    assert.equal(result.duplexSheets, 0);
    assert.equal(result.singleSheets, 1);
  });

  test('copies multiply sheets, not pages-per-sheet', () => {
    const result = countSheets({ printedPages: 4, sides: 'double', copies: 3 });
    assert.equal(result.totalSheets, 6);
    assert.equal(result.duplexSheets, 6);
    assert.equal(result.pagesPrinted, 12);
  });
});

/** Assert a 422 with a specific field named in `details`. */
function assertInvalid(fn, field) {
  assert.throws(fn, (error) => {
    assert.equal(error.statusCode, 422, `expected 422, got ${error.statusCode}`);
    assert.equal(error.code, 'INVALID_PRINT_REQUEST');
    assert.ok(
      error.details?.[field],
      `expected details.${field}, got ${JSON.stringify(error.details)}`,
    );
    return true;
  });
}

describe('request validation', () => {
  test('accepts a well-formed request', () => {
    const result = normalisePrintRequest(request());
    assert.equal(result.printedPages, 10);
    assert.deepEqual(result.pages, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  test('defaults to black and white, single-sided, A4', () => {
    const result = normalisePrintRequest({ pageCount: 3 });
    assert.equal(result.color, 'bw');
    assert.equal(result.sides, 'single');
    assert.equal(result.paperSize, 'A4');
    assert.equal(result.copies, 1);
  });

  test('rejects a document with no pages', () => {
    for (const pageCount of [0, -1, 2.5, 'many']) {
      assertInvalid(() => normalisePrintRequest(request({ pageCount })), 'pageCount');
    }
  });

  test('rejects impossible copy counts', () => {
    for (const copies of [0, -1, 51, 2.5]) {
      assertInvalid(() => normalisePrintRequest(request({ copies })), 'copies');
    }
  });

  test('rejects unknown print modes', () => {
    assertInvalid(() => normalisePrintRequest(request({ color: 'sepia' })), 'color');
    assertInvalid(() => normalisePrintRequest(request({ sides: 'triple' })), 'sides');
    assertInvalid(() => normalisePrintRequest(request({ paperSize: 'A0' })), 'paperSize');
  });

  test('rejects an invalid page selection without throwing a bare Error', () => {
    assert.throws(
      () => normalisePrintRequest(request({ selectedPages: '99' })),
      (error) => error.statusCode === 422 && Boolean(error.details.selectedPages),
    );
  });
});

describe('quoting — black and white', () => {
  test('single-sided 10 pages at ₹2 = ₹20', () => {
    const result = quote({ machine: monoMachine, request: request({ pageCount: 10 }) });
    assert.equal(result.totalPaise, 2000);
    assert.equal(result.display.total, '₹20.00');
  });

  test('duplex 10 pages at ₹3 per sheet = ₹15, not ₹30', () => {
    const result = quote({
      machine: monoMachine,
      request: request({ pageCount: 10, sides: 'double' }),
    });
    assert.equal(result.sheets.total, 5);
    assert.equal(result.totalPaise, 1500);
  });

  test('odd duplex: 7 pages = 3 duplex sheets + 1 single = ₹11', () => {
    const result = quote({
      machine: monoMachine,
      request: request({ pageCount: 7, sides: 'double' }),
    });
    assert.equal(result.sheets.duplex, 3);
    assert.equal(result.sheets.single, 1);
    assert.equal(result.totalPaise, 3 * 300 + 1 * 200);
  });

  test('copies multiply correctly', () => {
    const result = quote({ machine: monoMachine, request: request({ pageCount: 5, copies: 3 }) });
    assert.equal(result.pagesPrinted, 15);
    assert.equal(result.totalPaise, 3000);
  });

  test('page selection is what gets billed, not document length', () => {
    const result = quote({
      machine: monoMachine,
      request: request({ pageCount: 100, selectedPages: '1-3' }),
    });
    assert.equal(result.printedPages, 3);
    assert.equal(result.totalPaise, 600);
  });
});

describe('quoting — colour', () => {
  test('colour single-sided uses the colour rate', () => {
    const result = quote({
      machine: colorMachine,
      request: request({ pageCount: 4, color: 'color' }),
    });
    assert.equal(result.totalPaise, 4 * 800);
  });

  test('colour duplex uses the colour duplex rate', () => {
    const result = quote({
      machine: colorMachine,
      request: request({ pageCount: 4, color: 'color', sides: 'double' }),
    });
    assert.equal(result.totalPaise, 2 * 1400);
  });

  test('a mono printer refuses colour rather than silently charging B&W', () => {
    assert.throws(
      () => quote({ machine: monoMachine, request: request({ color: 'color' }) }),
      (error) => error.code === 'COLOR_UNSUPPORTED',
    );
  });
});

describe('quoting — surcharges and minimums', () => {
  test('A3 applies the configured surcharge', () => {
    const result = quote({
      machine: monoMachine,
      request: request({ pageCount: 10, paperSize: 'A3' }),
    });
    // 10 x ₹2 = ₹20, plus 60% A3 surcharge = ₹32
    assert.equal(result.totalPaise, 3200);
  });

  test('the minimum charge tops up a small job instead of replacing the breakdown', () => {
    const machine = {
      ...monoMachine,
      pricing: { ...monoMachine.pricing, minimumChargePaise: 500 },
    };
    const result = quote({ machine, request: request({ pageCount: 1 }) });

    assert.equal(result.totalPaise, 500);
    const minimumLine = result.lineItems.find((line) => line.code === 'minimum');
    assert.equal(minimumLine.amountPaise, 300);
    // The customer can still see they were charged for one sheet.
    assert.ok(result.lineItems.some((line) => line.code === 'print.single'));
  });

  test('the minimum charge does not apply to jobs already above it', () => {
    const machine = {
      ...monoMachine,
      pricing: { ...monoMachine.pricing, minimumChargePaise: 500 },
    };
    const result = quote({ machine, request: request({ pageCount: 10 }) });
    assert.equal(result.totalPaise, 2000);
    assert.equal(
      result.lineItems.some((line) => line.code === 'minimum'),
      false,
    );
  });

  test('the platform fee is reported separately, never hidden in the total', () => {
    const result = quote({
      machine: monoMachine,
      request: request({ pageCount: 10 }),
      platformFeeBps: 600,
    });
    assert.equal(result.subtotalPaise, 2000);
    assert.equal(result.platformFeePaise, 120);
    assert.equal(result.totalPaise, 2120);
    // And the arithmetic is internally consistent.
    assert.equal(
      result.lineItems.reduce((sum, line) => sum + line.amountPaise, 0),
      result.subtotalPaise,
    );
  });
});

describe('quoting — machine defaults', () => {
  test('a machine with no pricing still quotes using defaults', () => {
    const result = quote({
      machine: { printer: { supportsColor: false } },
      request: request({ pageCount: 1 }),
    });
    assert.ok(result.totalPaise > 0);
  });
});

describe('money formatting', () => {
  test('formats paise as rupees with two decimals', () => {
    assert.equal(formatPaise(0), '₹0.00');
    assert.equal(formatPaise(5), '₹0.05');
    assert.equal(formatPaise(200), '₹2.00');
    assert.equal(formatPaise(1234), '₹12.34');
    assert.equal(formatPaise(100000), '₹1000.00');
  });

  test('handles negative amounts (refund lines)', () => {
    assert.equal(formatPaise(-250), '-₹2.50');
  });
});

describe('money invariants', () => {
  test('every amount is an integer — no floating point drift anywhere', () => {
    for (const pages of [1, 3, 7, 13, 99]) {
      for (const sides of ['single', 'double']) {
        for (const copies of [1, 2, 7]) {
          const result = quote({
            machine: monoMachine,
            request: request({ pageCount: pages, sides, copies }),
            platformFeeBps: 600,
          });
          assert.ok(
            Number.isInteger(result.totalPaise),
            `total not integer for ${pages}/${sides}/${copies}`,
          );
          assert.ok(Number.isInteger(result.subtotalPaise));
          assert.ok(Number.isInteger(result.platformFeePaise));
          for (const line of result.lineItems) {
            assert.ok(Number.isInteger(line.amountPaise));
          }
        }
      }
    }
  });

  test('the total is always the sum of the parts', () => {
    const result = quote({
      machine: colorMachine,
      request: request({ pageCount: 17, sides: 'double', color: 'color', copies: 3 }),
      platformFeeBps: 600,
    });
    const lineSum = result.lineItems.reduce((sum, line) => sum + line.amountPaise, 0);
    assert.equal(lineSum, result.subtotalPaise);
    assert.equal(result.subtotalPaise + result.platformFeePaise, result.totalPaise);
  });
});
