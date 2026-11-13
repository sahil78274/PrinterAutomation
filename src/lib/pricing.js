import { clamp } from './utils.js';

/**
 * Canonical pricing engine. Every price displayed in the UI comes from here so
 * customer quotes, shop revenue and admin reports can never drift apart.
 *
 * pricing = {
 *   bwSingle, bwDouble, colorSingle, colorDouble   // INR, per billable unit
 *   a3Surcharge                                    // multiplier for A3 media
 *   minimumCharge
 * }
 *
 * BILLING MODEL
 * - Single-sided is billed **per printed side** (one page = one side).
 * - Double-sided is billed **per sheet** (one sheet carries two pages), which
 *   is how print shops actually quote it. A duplex sheet is therefore usually
 *   cheaper than two single-sided pages, never more expensive.
 */

export function getUnitPrice(pricing, { color, sides, paper = 'a4' }) {
  const base = color
    ? sides === 'double'
      ? pricing.colorDouble
      : pricing.colorSingle
    : sides === 'double'
      ? pricing.bwDouble
      : pricing.bwSingle;
  const surcharge = paper === 'a3' ? (pricing.a3Surcharge ?? 1.6) : 1;
  return Math.round(base * surcharge * 100) / 100;
}

export function getBillingUnit(sides) {
  return sides === 'double' ? 'sheet' : 'side';
}

/**
 * Calculate an itemised quote for one document.
 */
export function calculateQuote({
  pricing,
  pageCount,
  copies = 1,
  color = false,
  sides = 'single',
  paper = 'a4',
  finishing = 'none',
  finishingPrice = 0,
}) {
  const pages = clamp(Number(pageCount) || 0, 0, 5000);
  const copiesSafe = clamp(Number(copies) || 1, 1, 99);

  const sidesPerSheet = sides === 'double' ? 2 : 1;
  const sheetsPerCopy = Math.ceil(pages / sidesPerSheet);
  const printedSidesPerCopy = pages;
  // Billable units: pages when single-sided, sheets when double-sided.
  const billableUnitsPerCopy = sides === 'double' ? sheetsPerCopy : printedSidesPerCopy;

  const billingUnit = getBillingUnit(sides);
  const unitPrice = getUnitPrice(pricing, { color, sides, paper });

  const lineTotal = Math.round(billableUnitsPerCopy * copiesSafe * unitPrice * 100) / 100;
  const finishingTotal =
    finishing === 'none' ? 0 : Math.round(finishingPrice * copiesSafe * 100) / 100;
  const subtotal = Math.round((lineTotal + finishingTotal) * 100) / 100;
  const minimumTopUp =
    subtotal > 0 && pricing.minimumCharge && subtotal < pricing.minimumCharge
      ? Math.round((pricing.minimumCharge - subtotal) * 100) / 100
      : 0;
  const total = Math.round((subtotal + minimumTopUp) * 100) / 100;

  const sheetsUsed = sheetsPerCopy * copiesSafe;

  return {
    pages,
    copies: copiesSafe,
    sides,
    color,
    paper,
    finishing,
    billingUnit,
    unitPrice,
    billableUnitsPerCopy,
    sheetsPerCopy,
    printedSidesPerCopy,
    sheetsUsed,
    lineTotal,
    finishingTotal,
    minimumTopUp,
    subtotal,
    total,
  };
}

export function formatSides(sides) {
  return sides === 'double' ? 'Double-sided' : 'Single-sided';
}

export function formatColor(color) {
  return color ? 'Colour' : 'Black & white';
}

/** Human readable rate, e.g. "₹3.00 / sheet". */
export function formatUnitRate(quote) {
  return `₹${quote.unitPrice.toFixed(quote.unitPrice % 1 === 0 ? 0 : 2)} / ${quote.billingUnit}`;
}
