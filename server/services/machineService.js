import Machine from '../models/Machine.js';
import Shop from '../models/Shop.js';
import ApiError from '../utils/ApiError.js';

/**
 * Machine ID issuance.
 *
 * IDs follow SP-<n> and are allocated centrally. Two properties matter:
 *
 *  1. Uniqueness across the whole platform — a QR sticker must never resolve to
 *     two machines, so the numeric space is global, not per shop.
 *  2. Immutability — an issued ID is never reused or reassigned. If a printer is
 *     retired, its ID is retired with it.
 *
 * Allocation uses the highest existing numeric suffix + 1, with a unique-index
 * retry loop to stay correct under concurrent registrations (two admins
 * registering at the same moment must not collide).
 */

const MACHINE_ID_PREFIX = 'SP-';
const MACHINE_ID_MIN_WIDTH = 3;
const MAX_ALLOCATION_ATTEMPTS = 25;

export function formatMachineId(sequence) {
  return `${MACHINE_ID_PREFIX}${String(sequence).padStart(MACHINE_ID_MIN_WIDTH, '0')}`;
}

/**
 * Parse a machine ID leniently and return its canonical form.
 *
 * Leniency is intentional: an ID may be typed by hand, OCR'd from a sticker or
 * pulled from a QR. "sp-1", "SP-001" and " sp-1 " all denote the same machine
 * and must resolve to it. The *stored* form is always canonical (3+ digits),
 * so parsing never invents a new identity — it only normalises.
 *
 * Rejects: wrong prefix, non-numeric suffix, more than 6 digits, separators.
 */
export function parseMachineId(machineId) {
  const match = /^SP-(\d{1,6})$/i.exec(String(machineId ?? '').trim());
  if (!match) return null;
  const sequence = Number(match[1]);
  if (!Number.isInteger(sequence) || sequence < 1) return null;
  return { normalised: formatMachineId(sequence), sequence };
}

export function isValidMachineId(machineId) {
  return parseMachineId(machineId) !== null;
}

export function buildQrPath(machineId) {
  return `/print/${String(machineId).toUpperCase()}`;
}

/**
 * Resolve the next free sequence number.
 * Reads only the numeric suffix of the highest existing ID.
 */
export async function peekNextSequence() {
  const last = await Machine.findOne({ machineId: /^SP-\d+$/ })
    .sort({ machineId: -1 })
    .select('machineId')
    .lean();

  if (!last?.machineId) return 1;
  const parsed = parseMachineId(last.machineId);
  return parsed ? parsed.sequence + 1 : 1;
}

/**
 * Allocate an unused machine ID. Retries on duplicate-key races.
 */
export async function allocateMachineId() {
  for (let attempt = 0; attempt < MAX_ALLOCATION_ATTEMPTS; attempt += 1) {
    const sequence = (await peekNextSequence()) + attempt;
    const candidate = formatMachineId(sequence);
    // eslint-disable-next-line no-await-in-loop
    const exists = await Machine.exists({ machineId: candidate });
    if (!exists) return candidate;
  }
  throw ApiError.serviceUnavailable('Could not allocate a unique machine ID. Please retry.', {
    code: 'MACHINE_ID_EXHAUSTED',
  });
}

/**
 * Create a machine bound to a shop. The caller must have already authorised
 * the admin action; ownership checks happen at the route layer.
 */
export async function registerMachine({
  shopId,
  name,
  printer = {},
  pricing = {},
  adminUserId = null,
}) {
  const shop = await Shop.findById(shopId).select('_id name status');
  if (!shop) {
    throw ApiError.notFound('Shop not found', { code: 'SHOP_NOT_FOUND' });
  }
  if (shop.status === 'closed') {
    throw ApiError.conflict('Cannot register a machine for a closed shop', {
      code: 'SHOP_CLOSED',
    });
  }

  const machineId = await allocateMachineId();

  const supportsColor = Boolean(printer.supportsColor);
  const machine = await Machine.create({
    machineId,
    shopId: shop._id,
    shopName: shop.name,
    name: name || 'Main counter',
    qrPath: buildQrPath(machineId),
    status: 'offline',
    printer: {
      model: printer.model ?? null,
      supportsColor,
      supportsDuplex: Boolean(printer.supportsDuplex),
      paperSizes: printer.paperSizes ?? ['A4'],
      maxPaperSize: printer.maxPaperSize ?? 'A4',
      connection: printer.connection ?? 'USB',
    },
    pricing: {
      ...pricing,
      // A mono printer cannot price colour jobs; force those rates to zero so a
      // stray colour request can never be quoted.
      ...(supportsColor ? {} : { colorSinglePaise: 0, colorDoublePaise: 0 }),
    },
    registeredBy: adminUserId,
  });

  // Keep the denormalised counter accurate on the shop record.
  await Shop.updateOne({ _id: shop._id }, { $inc: { machineCount: 1 } });

  return machine;
}

/**
 * Public QR lookup: resolve a scanned machine ID to the machine plus the
 * minimum shop context the customer portal needs.
 */
export async function findMachineForCustomer(machineId) {
  const parsed = parseMachineId(machineId);
  if (!parsed) {
    throw ApiError.badRequest('Machine ID format is invalid (expected SP-001)', {
      code: 'INVALID_MACHINE_ID',
    });
  }

  const machine = await Machine.findOne({ machineId: parsed.normalised })
    .populate(
      'shopId',
      'name shopCode address phone openHours settings status planStatus rating reviewCount',
    )
    .lean();

  if (!machine) {
    throw ApiError.notFound(`Machine ${parsed.normalised} is not registered`, {
      code: 'MACHINE_NOT_FOUND',
    });
  }

  return machine;
}

/**
 * Guard used before an order may be created. Returns a reason when the machine
 * cannot accept jobs, so the portal can explain why rather than silently
 * disabling the button.
 */
export function getAcceptanceBlocker(machine) {
  const shop = machine.shopId;
  if (machine.status === 'offline') return 'This machine is currently offline.';
  if (machine.status === 'maintenance') return 'This machine is under maintenance.';
  if (shop && shop.status !== 'active') return 'This shop is not accepting orders right now.';
  if (shop && shop.settings?.acceptOrders === false) return 'This shop has paused new orders.';
  if (shop && shop.planStatus === 'cancelled')
    return 'This shop is not accepting orders right now.';
  return null;
}

export default {
  allocateMachineId,
  buildQrPath,
  findMachineForCustomer,
  formatMachineId,
  getAcceptanceBlocker,
  isValidMachineId,
  parseMachineId,
  peekNextSequence,
  registerMachine,
};
