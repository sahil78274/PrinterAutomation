import ApiError from '../utils/ApiError.js';

/**
 * Server-side pricing engine.
 *
 * The client never sends a price. It sends what it wants printed — page ranges,
 * copies, colour, sides, paper — and this module decides what that costs. Every
 * order created without a price computed here is rejected, so a tampered
 * request cannot buy a 500-page colour job for ₹2.
 *
 * ## Money
 *
 * All amounts are **integer paise** throughout. Rupees appear only at the
 * presentation edge. Floating point money produces rounding drift that shows up
 * as one-paisa discrepancies in invoices, which is exactly the kind of bug that
 * destroys trust in a billing system.
 *
 * ## Sheet maths
 *
 * This is where a printing business actually makes or loses money, so the rules
 * are explicit:
 *
 *   - A **sheet** has two sides. Duplex puts two pages on one sheet.
 *   - Duplex is priced per *sheet*, not per page, matching how shops quote.
 *   - A duplex job with an odd page count uses one sheet whose back is blank,
 *     and that sheet is charged at the single-sided rate. Charging duplex for a
 *     blank back is a real-world overcharge customers notice immediately.
 *   - `selectedPages` may be discontiguous ("1-3, 7"), so printed pages are
 *     counted from the selection, not from the document length.
 */

export const PRINT_MODES = Object.freeze({ BW: 'bw', COLOR: 'color' });
export const SIDES = Object.freeze({ SINGLE: 'single', DOUBLE: 'double' });
export const PAPER_SIZES = Object.freeze(['A4', 'A3', 'Letter', 'Legal']);

/** A3 is priced as a multiple of A4. Stored in basis points (16000 = 1.6x). */
const DEFAULT_A3_SURCHARGE_BPS = 16_000;

/**
 * Validate and normalise a print request against a document's page count.
 *
 * Throws 422 with field-level detail. Kept separate from `quote` so callers can
 * validate before pricing (and so the error shape is predictable).
 */
export function normalisePrintRequest({
  pageCount,
  selectedPages,
  copies,
  color,
  sides,
  paperSize,
}) {
  const errors = {};

  const totalPages = Number(pageCount);
  if (!Number.isInteger(totalPages) || totalPages < 1) {
    errors.pageCount = 'The document has no printable pages';
  }

  const copyCount = Number(copies ?? 1);
  if (!Number.isInteger(copyCount) || copyCount < 1 || copyCount > 50) {
    errors.copies = 'Copies must be a whole number between 1 and 50';
  }

  const mode = String(color ?? PRINT_MODES.BW).toLowerCase();
  if (!Object.values(PRINT_MODES).includes(mode)) {
    errors.color = "Choose either 'bw' or 'color'";
  }

  const sideMode = String(sides ?? SIDES.SINGLE).toLowerCase();
  if (!Object.values(SIDES).includes(sideMode)) {
    errors.sides = "Choose either 'single' or 'double'";
  }

  const size = String(paperSize ?? 'A4');
  if (!PAPER_SIZES.includes(size)) {
    errors.paperSize = `Paper size must be one of: ${PAPER_SIZES.join(', ')}`;
  }

  let pages = null;
  if (!errors.pageCount) {
    try {
      pages = parsePageRanges(selectedPages, totalPages);
    } catch (error) {
      errors.selectedPages = error.message;
    }
  }

  if (Object.keys(errors).length) {
    throw ApiError.unprocessable('This print request is not valid', {
      code: 'INVALID_PRINT_REQUEST',
      details: errors,
    });
  }

  return {
    totalPages,
    // No selection means "the whole document", which is the common case.
    pages: pages ?? rangeArray(1, totalPages),
    printedPages: (pages ?? rangeArray(1, totalPages)).length,
    copies: copyCount,
    color: mode,
    sides: sideMode,
    paperSize: size,
  };
}

function rangeArray(from, to) {
  const out = [];
  for (let page = from; page <= to; page += 1) out.push(page);
  return out;
}

/**
 * Parse a page selection into a sorted, de-duplicated list of page numbers.
 *
 * Accepts "1-5", "1,3,7", "2-4,9". Returns null for an empty selection, meaning
 * the whole document.
 *
 * Out-of-range pages are rejected rather than clamped: silently printing a
 * different set of pages than the customer asked for is worse than an error.
 */
export function parsePageRanges(input, totalPages) {
  if (input === undefined || input === null || input === '') return null;

  const parts = Array.isArray(input) ? input : String(input).split(',');
  const pages = new Set();

  for (const rawPart of parts) {
    const part = String(rawPart).trim();
    if (!part) continue;

    const rangeMatch = /^(\d+)\s*-\s*(\d+)$/.exec(part);
    if (rangeMatch) {
      const start = Number(rangeMatch[1]);
      const end = Number(rangeMatch[2]);
      if (start > end) {
        throw new Error(`Page range "${part}" is backwards — did you mean ${end}-${start}?`);
      }
      if (start < 1 || end > totalPages) {
        throw new Error(`Page range "${part}" is outside this document (1-${totalPages})`);
      }
      for (let page = start; page <= end; page += 1) pages.add(page);
      continue;
    }

    const single = Number(part);
    if (!Number.isInteger(single) || single < 1) {
      throw new Error(`"${part}" is not a page number`);
    }
    if (single > totalPages) {
      throw new Error(`Page ${single} does not exist in a ${totalPages}-page document`);
    }
    pages.add(single);
  }

  if (!pages.size) throw new Error('Select at least one page');

  return [...pages].sort((a, b) => a - b);
}

/**
 * Number of sheets used, and how many of them are charged as duplex.
 *
 * Odd duplex counts: the last sheet has a blank back and is charged single.
 */
export function countSheets({ printedPages, sides, copies }) {
  const pagesPerCopy = printedPages;
  let sheetsPerCopy;
  let duplexSheetsPerCopy;
  let singleSheetsPerCopy;

  if (sides === SIDES.DOUBLE) {
    duplexSheetsPerCopy = Math.floor(pagesPerCopy / 2);
    singleSheetsPerCopy = pagesPerCopy % 2; // trailing blank-back sheet
    sheetsPerCopy = duplexSheetsPerCopy + singleSheetsPerCopy;
  } else {
    sheetsPerCopy = pagesPerCopy;
    duplexSheetsPerCopy = 0;
    singleSheetsPerCopy = pagesPerCopy;
  }

  return {
    sheetsPerCopy,
    totalSheets: sheetsPerCopy * copies,
    duplexSheets: duplexSheetsPerCopy * copies,
    singleSheets: singleSheetsPerCopy * copies,
    pagesPrinted: pagesPerCopy * copies,
  };
}

/**
 * Rate card for a machine, in paise.
 *
 * Falls back to conservative defaults when a machine has no explicit pricing,
 * so a newly registered machine can still accept orders.
 */
export function rateCardFor(machine) {
  const pricing = machine?.pricing ?? {};
  return {
    bwSinglePaise: pricing.bwSinglePaise ?? 200,
    bwDoublePaise: pricing.bwDoublePaise ?? 300,
    colorSinglePaise: pricing.colorSinglePaise ?? 800,
    colorDoublePaise: pricing.colorDoublePaise ?? 1400,
    a3SurchargeBps: pricing.a3SurchargeBps ?? DEFAULT_A3_SURCHARGE_BPS,
    minimumChargePaise: pricing.minimumChargePaise ?? 500,
  };
}

/**
 * Compute the price of a validated print request.
 *
 * Returns a fully transparent breakdown — line items the customer can audit —
 * plus the total. Nothing is hidden in a margin line.
 */
export function quote({ machine, request, platformFeeBps = 0 }) {
  const normalised = request.printedPages ? request : normalisePrintRequest(request);

  const rates = rateCardFor(machine);
  const { printedPages, copies, color, sides, paperSize } = normalised;

  if (color === PRINT_MODES.COLOR && !machine?.printer?.supportsColor) {
    throw ApiError.unprocessable('This machine cannot print in colour', {
      code: 'COLOR_UNSUPPORTED',
      details: { color: 'Choose black and white for this machine' },
    });
  }

  const counts = countSheets({ printedPages, sides, copies });
  if (counts.totalSheets < 1) {
    throw ApiError.unprocessable('Nothing to print', { code: 'EMPTY_PRINT_REQUEST' });
  }

  const isColor = color === PRINT_MODES.COLOR;
  const duplexRate = isColor ? rates.colorDoublePaise : rates.bwDoublePaise;
  const singleRate = isColor ? rates.colorSinglePaise : rates.bwSinglePaise;

  const duplexLinePaise = counts.duplexSheets * duplexRate;
  const singleLinePaise = counts.singleSheets * singleRate;

  const basePaise = duplexLinePaise + singleLinePaise;

  // Paper surcharge, applied to the sheet cost rather than the total so that
  // the minimum charge cannot be inflated by it.
  const surchargeBps = paperSize === 'A3' ? rates.a3SurchargeBps - 10_000 : 0;
  const paperSurchargePaise = Math.round((basePaise * surchargeBps) / 10_000);

  const subtotalPaise = basePaise + paperSurchargePaise;

  // A shop's minimum charge tops up a small job rather than replacing the
  // breakdown, so the customer still sees what they are paying for.
  const minimumTopUpPaise = Math.max(0, rates.minimumChargePaise - subtotalPaise);
  const totalBeforeFee = subtotalPaise + minimumTopUpPaise;

  const platformFeePaise = Math.round((totalBeforeFee * platformFeeBps) / 10_000);
  const totalPaise = totalBeforeFee + platformFeePaise;

  return {
    currency: 'INR',
    printedPages,
    copies,
    pagesPrinted: counts.pagesPrinted,
    sheets: {
      perCopy: counts.sheetsPerCopy,
      total: counts.totalSheets,
      duplex: counts.duplexSheets,
      single: counts.singleSheets,
    },
    lineItems: [
      {
        code: 'print.duplex',
        label: `${isColor ? 'Colour' : 'B&W'} duplex sheets`,
        quantity: counts.duplexSheets,
        unitPaise: duplexRate,
        amountPaise: duplexLinePaise,
      },
      {
        code: 'print.single',
        label: `${isColor ? 'Colour' : 'B&W'} single-sided sheets`,
        quantity: counts.singleSheets,
        unitPaise: singleRate,
        amountPaise: singleLinePaise,
      },
      ...(paperSurchargePaise
        ? [
            {
              code: 'paper.a3',
              label: 'A3 paper surcharge',
              quantity: 1,
              unitPaise: paperSurchargePaise,
              amountPaise: paperSurchargePaise,
            },
          ]
        : []),
      ...(minimumTopUpPaise
        ? [
            {
              code: 'minimum',
              label: 'Minimum charge adjustment',
              quantity: 1,
              unitPaise: minimumTopUpPaise,
              amountPaise: minimumTopUpPaise,
            },
          ]
        : []),
    ],
    subtotalPaise: totalBeforeFee,
    platformFeePaise,
    totalPaise,
    // Presentation helpers. The authoritative values are the paise integers.
    display: {
      subtotal: formatPaise(totalBeforeFee),
      platformFee: formatPaise(platformFeePaise),
      total: formatPaise(totalPaise),
    },
  };
}

/** 1234 -> "₹12.34" */
export function formatPaise(paise) {
  const sign = paise < 0 ? '-' : '';
  const absolute = Math.abs(Math.round(paise));
  return `${sign}₹${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, '0')}`;
}

export default { normalisePrintRequest, quote, parsePageRanges, countSheets, rateCardFor };
