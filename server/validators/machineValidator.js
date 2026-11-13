import { cleanString, isObjectId, optionalEnum, requireString } from './common.js';

const PAPER_SIZES = ['A4', 'A3', 'Letter', 'Legal'];
const CONNECTIONS = ['USB', 'LAN', 'WiFi', 'Network'];

/**
 * Validate the payload for registering a machine.
 *
 * Note what is NOT accepted: `machineId`, `qrPath`, `status`, `agent`. Those are
 * generated or controlled by the server. A client that sends them is simply
 * ignored, so an attacker cannot pre-claim an ID or point a QR elsewhere.
 */
export function validateRegisterMachine(body = {}) {
  const errors = {};
  const value = {};

  const shopId = cleanString(body.shopId, 24);
  if (!shopId) errors.shopId = 'Shop is required';
  else if (!isObjectId(shopId)) errors.shopId = 'Shop ID is invalid';
  value.shopId = shopId;

  value.name = requireString(errors, 'name', body.name, { max: 80 });

  const printer = body.printer ?? {};
  const paperSizes = Array.isArray(printer.paperSizes)
    ? printer.paperSizes.filter((size) => PAPER_SIZES.includes(size))
    : ['A4'];

  value.printer = {
    model: cleanString(printer.model, 120),
    supportsColor: Boolean(printer.supportsColor),
    supportsDuplex: Boolean(printer.supportsDuplex),
    paperSizes: paperSizes.length ? paperSizes : ['A4'],
    maxPaperSize:
      optionalEnum(errors, 'printer.maxPaperSize', printer.maxPaperSize, PAPER_SIZES) ?? 'A4',
    connection:
      optionalEnum(errors, 'printer.connection', printer.connection, CONNECTIONS) ?? 'USB',
  };

  // Optional overrides. All money values are integer paise.
  const pricing = body.pricing ?? {};
  const priceFields = [
    ['bwSinglePaise', 0, 100_000],
    ['bwDoublePaise', 0, 100_000],
    ['colorSinglePaise', 0, 100_000],
    ['colorDoublePaise', 0, 100_000],
    ['minimumChargePaise', 0, 100_000],
  ];

  value.pricing = {};
  for (const [field, min, max] of priceFields) {
    if (pricing[field] === undefined) continue;
    const parsed = Number(pricing[field]);
    if (!Number.isFinite(parsed) || parsed < min || parsed > max || !Number.isInteger(parsed)) {
      errors[`pricing.${field}`] = 'Must be a whole number of paise';
    } else {
      value.pricing[field] = parsed;
    }
  }

  return { value, errors };
}

/** Validate a :machineId path parameter. */
export function validateMachineIdParam(params = {}) {
  const errors = {};
  const raw = cleanString(params.machineId, 12);

  // Accept unpadded and zero-padded input ("sp-1", "SP-0007") but canonicalise
  // numerically to "SP-001"/"SP-007" — the same rule machineService applies, so
  // the validator and the service can never disagree about identity.
  const match = raw ? /^SP-(\d{1,6})$/i.exec(raw) : null;
  const sequence = match ? Number(match[1]) : null;
  // Sequence 0 has never been issued: allocation starts at 1. Rejecting it here
  // yields a clear 422 instead of a mysterious 404 from the database.
  const valid = match !== null && Number.isInteger(sequence) && sequence >= 1;

  if (!raw) {
    errors.machineId = 'Machine ID is required';
  } else if (!valid) {
    errors.machineId = 'Machine ID must look like SP-001';
  }

  return {
    value: { machineId: valid ? `SP-${String(sequence).padStart(3, '0')}` : null },
    errors,
  };
}

export { PAPER_SIZES };
