import { cleanString, optionalEnum } from './common.js';

/**
 * Print Agent request validation.
 *
 * Agents are unattended software, so validation here is about protecting the
 * server from a buggy or compromised agent, not about user-friendliness: every
 * field the agent can send is bounded before it is stored or acted on.
 */

const PRINT_MODES = ['virtual', 'real'];

export function validateAgentRegistration(body = {}) {
  const errors = {};
  const value = {};

  const machineId = cleanString(body.machineId, 12);
  if (!machineId) errors.machineId = 'A machine is required';
  else value.machineId = machineId.toUpperCase();

  value.name = cleanString(body.name, 80);
  value.printerName = cleanString(body.printerName, 120);
  value.platform = cleanString(body.platform, 40);
  value.printMode = optionalEnum(errors, 'printMode', body.printMode, PRINT_MODES) ?? 'virtual';

  return { value, errors };
}

export function validateAgentRevoke(body = {}) {
  const errors = {};
  const agentId = cleanString(body.agentId, 40);
  if (!agentId) errors.agentId = 'agentId is required';
  return { value: { agentId }, errors };
}

export function validateHeartbeat(body = {}) {
  const errors = {};
  const value = {};

  value.status =
    optionalEnum(errors, 'status', body.status, ['online', 'busy', 'degraded']) ?? 'online';
  value.version = cleanString(body.version, 32);

  if (body.queueDepth !== undefined) {
    const depth = Number(body.queueDepth);
    if (!Number.isInteger(depth) || depth < 0 || depth > 10_000) {
      errors.queueDepth = 'queueDepth must be a whole number between 0 and 10000';
    } else {
      value.queueDepth = depth;
    }
  }

  if (body.printer !== undefined) {
    if (typeof body.printer !== 'object' || body.printer === null || Array.isArray(body.printer)) {
      errors.printer = 'printer must be an object';
    } else {
      // Only the values an agent legitimately reports; anything else is dropped
      // rather than stored, so an agent cannot inject arbitrary fields.
      value.printer = {};
      for (const key of ['paperPercent', 'tonerPercent']) {
        if (body.printer[key] === undefined) continue;
        const percent = Number(body.printer[key]);
        if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
          errors[`printer.${key}`] = 'Must be between 0 and 100';
        } else {
          value.printer[key] = percent;
        }
      }
    }
  }

  return { value, errors };
}

export function validatePrintStart(body = {}) {
  const errors = {};
  const idempotencyKey = cleanString(body.idempotencyKey, 128);
  if (body.idempotencyKey !== undefined && !idempotencyKey) {
    errors.idempotencyKey = 'idempotencyKey must be a non-empty string when provided';
  }
  return { value: { idempotencyKey }, errors };
}

export function validateJobFailure(body = {}) {
  const errors = {};
  const value = {};

  const reason = cleanString(body.reason, 300);
  if (!reason) errors.reason = 'A failure reason is required';
  else value.reason = reason;

  value.retryable = body.retryable !== false;

  return { value, errors };
}
