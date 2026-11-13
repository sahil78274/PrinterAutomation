import { cleanString, clampInt } from './common.js';

/**
 * Order request validation.
 *
 * Note what is absent: any money field. The client may send `totalPaise` and it
 * is simply dropped by this validator, so it cannot reach the pricing engine or
 * the database. Prices come from the server, always.
 */

const COLORS = ['bw', 'color'];
const SIDE_MODES = ['single', 'double'];
const PAPER_SIZES = ['A4', 'A3', 'Letter', 'Legal'];

export function validateCreateOrder(body = {}) {
  const errors = {};
  const value = {};

  const machineId = cleanString(body.machineId, 12);
  if (!machineId) errors.machineId = 'A machine is required';
  else value.machineId = machineId.toUpperCase();

  const documentId = cleanString(body.documentId, 64);
  if (!documentId) errors.documentId = 'Upload a document first';
  else value.documentId = documentId;

  value.copies = clampInt(body.copies ?? 1, { min: 1, max: 50, fallback: 1 });
  if (body.copies !== undefined && Number(body.copies) !== value.copies) {
    errors.copies = 'Copies must be a whole number between 1 and 50';
  }

  const color = String(body.color ?? 'bw').toLowerCase();
  if (!COLORS.includes(color)) errors.color = "Choose either 'bw' or 'color'";
  else value.color = color;

  const sides = String(body.sides ?? 'single').toLowerCase();
  if (!SIDE_MODES.includes(sides)) errors.sides = "Choose either 'single' or 'double'";
  else value.sides = sides;

  const paperSize = String(body.paperSize ?? 'A4');
  if (!PAPER_SIZES.includes(paperSize)) {
    errors.paperSize = `Paper size must be one of: ${PAPER_SIZES.join(', ')}`;
  } else {
    value.paperSize = paperSize;
  }

  // Page selection is passed through as a string and parsed against the real
  // page count by the pricing engine, which is the only place that knows it.
  const selectedPages = cleanString(body.selectedPages, 500);
  if (selectedPages) value.selectedPages = selectedPages;

  value.idempotencyKey = cleanString(body.idempotencyKey, 128);

  return { value, errors };
}

export function validateBeginPayment(body = {}) {
  const errors = {};
  const outcome = String(body.outcome ?? 'success');
  if (!['success', 'failure'].includes(outcome)) {
    errors.outcome = "Simulated outcome must be 'success' or 'failure'";
  }
  return { value: { outcome }, errors };
}

export function validateConfirmPayment(body = {}) {
  const errors = {};
  const value = {};

  value.attemptId = cleanString(body.attemptId, 64);

  const outcome = String(body.outcome ?? 'success');
  if (!['success', 'failure'].includes(outcome)) {
    errors.outcome = "Simulated outcome must be 'success' or 'failure'";
  } else {
    value.outcome = outcome;
  }

  return { value, errors };
}

export function validateCancelOrder(body = {}) {
  const errors = {};
  return { value: { reason: cleanString(body?.reason, 200) ?? 'Cancelled by customer' }, errors };
}
