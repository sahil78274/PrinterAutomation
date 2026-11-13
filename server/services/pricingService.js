import ApiError from '../utils/ApiError.js';

/**
 * Server-side pricing engine — the authority on what a job costs.
 *
 * Money is handled in integer paise throughout. The client may show an
 * optimistic estimate, but the amount actually recorded on an order must come
 * from this module; no endpoint accepts a client-supplied total.
 *
 * Billing model (mirrors the Phase 1 frontend so quotes agree):
 *   - single-sided → billed per printed page
 *   - double-sided → billed per sheet (one sheet carries two pages)
 *   - A3 applies a basis-point multiplier
 *   - a minimum charge tops up very small orders
 */

export const PLATFORM_FEE_BPS = {
  starter: 600, // 6.00%
  growth: 350, // 3.50%
  scale: 200, // 2.00%
};

const SUPPORTED_PAPERS = ['A4', 'A3', 'Letter', 'Legal'];

export function bpsToMultiplier(bps) {
  return 1 + bps / 10_000;
}

export function sheetsForPages(pageCount, sides) {
  const pages = Math.max(0, Number(pageCount) || 0);
  return sides === 'double' ? Math.ceil(pages / 2) : pages;
}

/**
 * Price a single document selection against a machine's pricing config.
 * @returns {{ billableUnits:number, unitPricePaise:number, lineTotalPaise:number }}
 */
export function priceDocument(
  { pageCount, copies = 1, color = false, sides = 'single', paperSize = 'A4' },
  pricing,
) {
  if (!pricing) {
    throw ApiError.internal('Machine pricing configuration is missing', {
      code: 'PRICING_MISSING',
    });
  }

  if (!SUPPORTED_PAPERS.includes(paperSize)) {
    throw ApiError.badRequest(`Unsupported paper size "${paperSize}"`, {
      code: 'UNSUPPORTED_PAPER',
    });
  }

  const pages = Math.max(0, Number(pageCount) || 0);
  if (pages === 0) {
    throw ApiError.badRequest('A document must contain at least one page', {
      code: 'EMPTY_DOCUMENT',
    });
  }

  const copyCount = Math.min(99, Math.max(1, Number(copies) || 1));
  const duplicated = sides === 'double';
  const billableUnits = sheetsForPages(pages, sides);

  const base = color
    ? duplicated
      ? pricing.colorDoublePaise
      : pricing.colorSinglePaise
    : duplicated
      ? pricing.bwDoublePaise
      : pricing.bwSinglePaise;

  if (color && !base) {
    throw ApiError.unprocessable('Colour printing is not available on this machine', {
      code: 'COLOR_UNSUPPORTED',
    });
  }

  const surchargeMultiplier = paperSize === 'A3' ? bpsToMultiplier(pricing.a3SurchargeBps ?? 0) : 1;
  const unitPricePaise = Math.round(base * surchargeMultiplier);
  const lineTotalPaise = unitPricePaise * billableUnits * copyCount;

  return {
    billableUnits,
    unitPricePaise,
    lineTotalPaise,
    copies: copyCount,
    pages,
    sides,
    color,
    paperSize,
  };
}

/**
 * Price a whole order and apply the minimum charge plus platform fee.
 * @param {object[]} documents  validated document selections
 * @param {object}   pricing    machine pricing config
 * @param {string}   planId     shop plan, drives the commission
 */
export function priceOrder({ documents, pricing, planId = 'starter' }) {
  if (!Array.isArray(documents) || documents.length === 0) {
    throw ApiError.badRequest('An order requires at least one document', {
      code: 'NO_DOCUMENTS',
    });
  }

  const lines = documents.map((doc) => ({
    documentName: doc.documentName,
    ...priceDocument(doc, pricing),
  }));

  let subtotalPaise = lines.reduce((sum, line) => sum + line.lineTotalPaise, 0);

  const minimumChargePaise = Number(pricing.minimumChargePaise) || 0;
  let minimumTopUpPaise = 0;
  if (subtotalPaise > 0 && subtotalPaise < minimumChargePaise) {
    minimumTopUpPaise = minimumChargePaise - subtotalPaise;
    subtotalPaise = minimumChargePaise;
  }

  const feeBps = PLATFORM_FEE_BPS[planId] ?? PLATFORM_FEE_BPS.starter;
  const platformFeePaise = Math.round((subtotalPaise * feeBps) / 10_000);
  const totalPaise = subtotalPaise; // Customer pays the subtotal; the fee is deducted from the shop.

  return {
    lines: lines.map((line) => ({
      documentName: line.documentName,
      amountPaise: line.lineTotalPaise,
      billableUnits: line.billableUnits,
      unitPricePaise: line.unitPricePaise,
      pages: line.pages,
      copies: line.copies,
      sides: line.sides,
      color: line.color,
      paperSize: line.paperSize,
    })),
    subtotalPaise,
    minimumTopUpPaise,
    platformFeePaise,
    platformFeeBps: feeBps,
    shopEarningPaise: totalPaise - platformFeePaise,
    totalPaise,
  };
}

export default { PLATFORM_FEE_BPS, priceDocument, priceOrder, sheetsForPages };
