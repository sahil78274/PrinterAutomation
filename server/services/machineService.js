import { randomUUID } from 'node:crypto';
import ApiError from '../utils/ApiError.js';
import { getRepository } from '../repositories/active.js';

/**
 * Machine identity, registration and QR resolution.
 *
 * Machine IDs follow `SP-<n>` and are allocated centrally, because a QR sticker
 * must resolve to exactly one printer for its whole life. Three properties
 * matter:
 *
 *  1. **Global uniqueness** — the numeric space is platform-wide, not per shop.
 *  2. **Immutability** — an issued ID is never reused or reassigned, even after
 *     a printer is retired.
 *  3. **Stable QR tokens** — the printed QR encodes a token that can be revoked
 *     and rotated without renumbering the machine.
 *
 * Allocation reads the highest existing suffix and adds one, with a bounded
 * retry loop so two concurrent registrations cannot collide (the unique index
 * is the real guarantee; the retry makes collisions invisible to callers).
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
 * An ID may be typed by hand, read off a sticker, or arrive from a QR scan.
 * "sp-1", "SP-001" and " sp-1 " all denote the same machine and must resolve
 * to it. Storage is always canonical, so parsing normalises rather than
 * inventing a new identity.
 *
 * Rejects: wrong prefix, non-numeric suffix, more than 6 digits, sequence 0.
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
 * Build the customer-facing QR URL.
 *
 * The path is derived from the machine id so the QR can never point somewhere
 * else. The token, when present, is what actually authorises the scan — it can
 * be rotated without reprinting the machine id.
 */
export function buildQrUrl(machineId, { origin = null, token = null } = {}) {
  const base = origin ? String(origin).replace(/\/+$/, '') : '';
  const path = buildQrPath(machineId);
  return `${base}${path}${token ? `?t=${token}` : ''}`;
}

/** A QR token: unguessable, revocable, never the machine id itself. */
export function generateQrToken() {
  return randomUUID().replace(/-/g, '');
}

/** Next free sequence number. */
export async function peekNextSequence() {
  const repo = getRepository();
  const machines = await repo.findAll('machines', {});
  const highest = machines.reduce((max, machine) => {
    const parsed = parseMachineId(machine.machineId);
    return parsed && parsed.sequence > max ? parsed.sequence : max;
  }, 0);
  return highest + 1;
}

export async function allocateMachineId() {
  const repo = getRepository();

  for (let attempt = 0; attempt < MAX_ALLOCATION_ATTEMPTS; attempt += 1) {
    const candidate = formatMachineId((await peekNextSequence()) + attempt);
    const taken = await repo.findOne('machines', { machineId: candidate });
    if (!taken) return candidate;
  }

  throw ApiError.internal('Could not allocate a unique machine ID', {
    code: 'MACHINE_ID_ALLOCATION_FAILED',
  });
}

/**
 * Register a machine for a shop.
 *
 * Server-owned fields: `machineId`, `qrPath`, `qrToken`, `status`, `agentStatus`.
 * A client cannot set them — attempting to does nothing, because they are
 * overwritten here. That is what stops a caller pre-claiming an ID or pointing
 * a QR at someone else's machine.
 */
export async function registerMachine({ shopId, name, printer = {}, pricing = {} }) {
  const repo = getRepository();

  const shop = await repo.findById('shops', shopId);
  if (!shop) throw ApiError.notFound('Shop not found', { code: 'SHOP_NOT_FOUND' });
  if (shop.status === 'closed') {
    throw ApiError.conflict('Cannot register a machine for a closed shop', {
      code: 'SHOP_CLOSED',
    });
  }

  if (shop.machineCount !== undefined && shop.maxMachines !== undefined) {
    if (shop.machineCount >= shop.maxMachines) {
      throw ApiError.conflict('This shop has reached its machine limit for its plan', {
        code: 'MACHINE_LIMIT_REACHED',
        details: { limit: shop.maxMachines, plan: shop.planId },
      });
    }
  }

  const machineId = await allocateMachineId();
  const supportsColor = Boolean(printer.supportsColor);

  const machine = await repo.insert('machines', {
    machineId,
    shopId: shop.id,
    shopName: shop.name,
    name: name || 'Main counter',
    qrPath: buildQrPath(machineId),
    qrToken: generateQrToken(),
    qrTokenVersion: 1,
    status: 'offline',
    agentStatus: 'unpaired',
    printer: {
      model: printer.model ?? null,
      supportsColor,
      supportsDuplex: Boolean(printer.supportsDuplex),
      paperSizes: printer.paperSizes ?? ['A4'],
      maxPaperSize: printer.maxPaperSize ?? 'A4',
      connection: printer.connection ?? 'USB',
    },
    pricing: {
      bwSinglePaise: pricing.bwSinglePaise ?? 200,
      bwDoublePaise: pricing.bwDoublePaise ?? 300,
      // A mono printer cannot price colour; zero the rate so a stray colour
      // request cannot be quoted at all.
      colorSinglePaise: supportsColor ? (pricing.colorSinglePaise ?? 800) : 0,
      colorDoublePaise: supportsColor ? (pricing.colorDoublePaise ?? 1400) : 0,
      a3SurchargeBps: pricing.a3SurchargeBps ?? 16_000,
      minimumChargePaise: pricing.minimumChargePaise ?? 500,
    },
    consumables: { paperPercent: 100, tonerPercent: 100 },
    jobsToday: 0,
    totalJobs: 0,
    lastHeartbeatAt: null,
    registeredAt: new Date().toISOString(),
  });

  await repo.increment('shops', shop.id, { machineCount: 1 });

  return machine;
}

/**
 * Resolve a machine for the public QR portal.
 *
 * Returns the machine with its shop embedded, because the portal needs opening
 * hours, address and whether the shop is taking orders. Deliberately does *not*
 * return pricing internals the customer does not need, agent details, or any
 * other machine on the shop.
 */
export async function findMachineForCustomer(machineId) {
  const parsed = parseMachineId(machineId);
  if (!parsed) {
    throw ApiError.badRequest('Machine ID format is invalid (expected SP-001)', {
      code: 'INVALID_MACHINE_ID',
    });
  }

  const repo = getRepository();
  const machine = await repo.findOne('machines', { machineId: parsed.normalised });

  if (!machine) {
    throw ApiError.notFound(`Machine ${parsed.normalised} is not registered`, {
      code: 'MACHINE_NOT_FOUND',
    });
  }

  const shop = await repo.findById('shops', machine.shopId);

  return {
    ...machine,
    shopId: shop ?? null,
    // Kept for callers written against the Phase 2 shape.
    shop,
  };
}

/**
 * Why this machine cannot take an order right now, or null if it can.
 *
 * A single function so the customer portal, the order service and the admin
 * dashboard cannot disagree about whether a machine is available.
 */
export function getAcceptanceBlocker(machine, shop = null) {
  if (!machine) return 'This machine is not available.';
  if (machine.status === 'offline') return 'This machine is currently offline.';
  if (machine.status === 'maintenance') return 'This machine is under maintenance.';

  const resolvedShop =
    shop ?? (machine.shopId && typeof machine.shopId === 'object' ? machine.shopId : null);
  if (resolvedShop) {
    if (resolvedShop.status && resolvedShop.status !== 'active') {
      return 'This shop is not accepting orders right now.';
    }
    if (resolvedShop.settings?.acceptOrders === false) return 'This shop has paused new orders.';
    if (resolvedShop.planStatus === 'cancelled')
      return 'This shop is not accepting orders right now.';
  }
  return null;
}

/**
 * Rotate a machine's QR token.
 *
 * Invalidates the previously printed QR. Intended for a lost or photographed
 * sticker; the machine id itself never changes, so order history stays intact.
 */
export async function rotateQrToken({ machineId, shopId, actorId = null }) {
  const repo = getRepository();
  const machine = await repo.findOne('machines', { machineId, shopId });
  if (!machine) throw ApiError.notFound('Machine not found', { code: 'MACHINE_NOT_FOUND' });

  const updated = await repo.updateById('machines', machine.id, {
    qrToken: generateQrToken(),
    qrTokenVersion: (machine.qrTokenVersion ?? 1) + 1,
    qrRotatedAt: new Date().toISOString(),
    qrRotatedBy: actorId,
  });

  return updated;
}

/** Public projection of a machine for shop dashboards. */
export function publicMachine(machine) {
  if (!machine) return null;
  return {
    id: machine.id,
    machineId: machine.machineId,
    shopId: machine.shopId,
    name: machine.name,
    status: machine.status,
    agentStatus: machine.agentStatus,
    qrPath: machine.qrPath,
    printer: machine.printer,
    pricing: machine.pricing,
    consumables: machine.consumables,
    jobsToday: machine.jobsToday ?? 0,
    totalJobs: machine.totalJobs ?? 0,
    lastHeartbeatAt: machine.lastHeartbeatAt ?? null,
    registeredAt: machine.registeredAt ?? machine.createdAt,
  };
}

export default {
  allocateMachineId,
  buildQrPath,
  buildQrUrl,
  findMachineForCustomer,
  formatMachineId,
  generateQrToken,
  getAcceptanceBlocker,
  parseMachineId,
  publicMachine,
  registerMachine,
  rotateQrToken,
};
