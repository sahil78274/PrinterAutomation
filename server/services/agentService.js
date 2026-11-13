import { createHash, randomUUID } from 'node:crypto';
import ApiError from '../utils/ApiError.js';
import logger from '../utils/logger.js';
import { getRepository } from '../repositories/active.js';
import { emitAgentPresence } from './realtimeService.js';

/**
 * Print Agent registration, authentication and presence.
 *
 * ## Why agents have their own credentials
 *
 * An agent runs unattended on a shop's PC. It cannot hold a user session, and a
 * user session would be both too powerful (it could reprice machines) and too
 * fragile (it expires while the shop is closed). So an agent gets:
 *
 *   - a stable `agentId` (public identifier)
 *   - a high-entropy `agentKey` (the secret, stored only as a SHA-256 digest)
 *   - a bound `machineId`, so it can only ever serve one printer
 *
 * The key is presented as `X-Agent-Key` together with `X-Agent-Id`. Both are
 * checked, and the key is compared via digest lookup, so the plaintext secret is
 * never persisted.
 *
 * ## Presence
 *
 * Heartbeats keep `lastSeenAt` fresh. Anything older than
 * `AGENT_OFFLINE_AFTER_MS` is treated as offline at read time rather than by a
 * background sweep, so the status is always correct without a cron job.
 */

/** An agent that has not checked in for this long is considered offline. */
export const AGENT_OFFLINE_AFTER_MS = 90_000;

/** Virtual mode simulates the printer; it never claims paper moved. */
export const PRINT_MODES = Object.freeze({
  VIRTUAL: 'virtual',
  REAL: 'real',
});

export function hashAgentKey(key) {
  return createHash('sha256').update(String(key)).digest('hex');
}

/**
 * Register an agent for a machine.
 *
 * Admin or owning-shop action: this is the point where a machine gains the
 * ability to print, so it must not be self-service from the internet.
 * Returns the plaintext key exactly once.
 */
export async function registerAgent({
  machineId,
  shopId,
  name = null,
  printMode = PRINT_MODES.VIRTUAL,
  printerName = null,
  platform = null,
}) {
  const repo = getRepository();

  if (!Object.values(PRINT_MODES).includes(printMode)) {
    throw ApiError.badRequest("printMode must be 'virtual' or 'real'", {
      code: 'INVALID_PRINT_MODE',
    });
  }

  const machine = await repo.findOne('machines', { machineId, shopId });
  if (!machine) {
    throw ApiError.notFound('Machine not found for this shop', { code: 'MACHINE_NOT_FOUND' });
  }

  // One live agent per machine: two agents on one printer would double-print.
  const existing = await repo.findOne('printAgents', { machineId, shopId });
  if (existing && !existing.revokedAt) {
    throw ApiError.conflict('This machine already has a registered agent', {
      code: 'AGENT_ALREADY_REGISTERED',
      details: { agentId: existing.agentId },
    });
  }

  const agentKey = randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '');
  const agent = await repo.insert('printAgents', {
    agentId: `AG-${randomUUID().slice(0, 8)}`,
    agentKeyHash: hashAgentKey(agentKey),
    machineId,
    shopId,
    name: name ?? `${machineId} agent`,
    printMode,
    printerName,
    platform,
    version: null,
    lastSeenAt: null,
    revokedAt: null,
    createdAt: new Date().toISOString(),
  });

  // The machine now has a paired agent; it stays offline until the first heartbeat.
  await repo.updateById('machines', machine.id, { agentStatus: 'paired' });

  return {
    agent: publicAgent(agent),
    // Shown exactly once. There is no endpoint to retrieve it again.
    agentKey,
  };
}

/** Revoke an agent (machine retired, PC replaced, key leaked). */
export async function revokeAgent({ agentId, shopId }) {
  const repo = getRepository();
  const agent = await repo.findOne('printAgents', { agentId, shopId });
  if (!agent) throw ApiError.notFound('Agent not found', { code: 'AGENT_NOT_FOUND' });

  await repo.updateById('printAgents', agent.id, { revokedAt: new Date().toISOString() });
  const machine = await repo.findOne('machines', { machineId: agent.machineId, shopId });
  if (machine) {
    await repo.updateById('machines', machine.id, { agentStatus: 'revoked', status: 'offline' });
  }
  emitAgentPresence(shopId, { agentId, machineId: agent.machineId, online: false, revoked: true });

  return { revoked: true };
}

/**
 * Authenticate an agent from request headers.
 *
 * Returns the agent record or throws 401. Deliberately does not say *which* part
 * failed — "unknown agent" and "wrong key" must be indistinguishable.
 */
export async function authenticateAgent(headers = {}) {
  const agentId = headers['x-agent-id'];
  const agentKey = headers['x-agent-key'];

  if (!agentId || !agentKey) {
    throw ApiError.unauthorized('Agent credentials are required', { code: 'AGENT_AUTH_REQUIRED' });
  }

  const repo = getRepository();
  const agent = await repo.findOne('printAgents', { agentId });

  // Constant shape regardless of failure reason.
  if (!agent) {
    throw ApiError.unauthorized('Invalid agent credentials', { code: 'AGENT_UNAUTHORIZED' });
  }
  if (agent.revokedAt) {
    throw ApiError.forbidden('This agent has been revoked', { code: 'AGENT_REVOKED' });
  }
  if (agent.agentKeyHash !== hashAgentKey(agentKey)) {
    throw ApiError.unauthorized('Invalid agent credentials', { code: 'AGENT_UNAUTHORIZED' });
  }

  return agent;
}

/** Record a heartbeat and return the work the agent should do next. */
export async function heartbeat({
  agent,
  status = 'online',
  version = null,
  queueDepth = null,
  printer = null,
}) {
  const repo = getRepository();

  const updated = await repo.updateById('printAgents', agent.id, {
    lastSeenAt: new Date().toISOString(),
    version,
    queueDepth,
    printerStatus: printer ?? null,
  });

  const machine = await repo.findOne('machines', {
    machineId: agent.machineId,
    shopId: agent.shopId,
  });
  if (machine) {
    await repo.updateById('machines', machine.id, {
      status: status === 'online' ? (queueDepth > 0 ? 'busy' : 'online') : 'offline',
      lastHeartbeatAt: new Date().toISOString(),
      agentStatus: 'connected',
      ...(printer ? { consumables: printer } : {}),
    });
    emitAgentPresence(agent.shopId, {
      agentId: agent.agentId,
      machineId: agent.machineId,
      online: true,
      status,
    });
  }

  return {
    agent: publicAgent(updated),
    machine: machine
      ? { machineId: machine.machineId, name: machine.name, status: machine.status }
      : null,
    serverTime: new Date().toISOString(),
    // Told to the agent so it can poll sensibly without hardcoding a cadence.
    heartbeatIntervalMs: 30_000,
  };
}

/**
 * Report a printing outcome from the agent's local printer.
 *
 * `mode: 'virtual'` records the simulated output with `simulated: true` so the
 * customer screen, the shop dashboard and the audit log all agree that no paper
 * moved. It is never presented as a physical print.
 */
export function describePrintOutcome({ mode, pagesPrinted, printerName = null }) {
  if (mode === PRINT_MODES.VIRTUAL) {
    return {
      simulated: true,
      pagesPrinted,
      printerName: null,
      note: 'Printed in virtual mode — no physical output was produced',
    };
  }
  return {
    simulated: false,
    pagesPrinted,
    printerName,
    note: `Printed on ${printerName ?? 'the configured printer'}`,
  };
}

/** Mark agents offline in bulk. Returns how many were considered stale. */
export async function sweepStaleAgents(now = Date.now()) {
  const repo = getRepository();
  const agents = await repo.findAll('printAgents', {});
  const stale = agents.filter(
    (agent) =>
      !agent.revokedAt &&
      (!agent.lastSeenAt || now - new Date(agent.lastSeenAt).getTime() > AGENT_OFFLINE_AFTER_MS),
  );

  for (const agent of stale) {
    const machine = await repo.findOne('machines', {
      machineId: agent.machineId,
      shopId: agent.shopId,
    });
    if (machine && machine.status !== 'maintenance') {
      await repo.updateById('machines', machine.id, {
        status: 'offline',
        agentStatus: 'disconnected',
      });
    }
  }

  logger.debug?.(`Agent sweep: ${stale.length} considered offline`);
  return { stale: stale.length };
}

export function isAgentOnline(agent, now = Date.now()) {
  if (!agent?.lastSeenAt || agent.revokedAt) return false;
  return now - new Date(agent.lastSeenAt).getTime() <= AGENT_OFFLINE_AFTER_MS;
}

/** Client-safe projection. Never includes the key or its digest. */
export function publicAgent(agent) {
  if (!agent) return null;
  return {
    agentId: agent.agentId,
    machineId: agent.machineId,
    shopId: agent.shopId,
    name: agent.name,
    printMode: agent.printMode,
    printerName: agent.printerName,
    platform: agent.platform,
    version: agent.version,
    online: isAgentOnline(agent),
    lastSeenAt: agent.lastSeenAt,
    revokedAt: agent.revokedAt ?? null,
  };
}
