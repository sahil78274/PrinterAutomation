import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/**
 * Agent configuration.
 *
 * Precedence, highest first:
 *   1. environment variables
 *   2. agent.config.json (written by `register`)
 *   3. defaults
 *
 * Environment wins so a service wrapper or a container can override a value
 * without editing a file on disk.
 */

export const CONFIG_FILENAME = 'agent.config.json';
export const PRINT_MODES = ['real', 'virtual'];

function toInt(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** Where the agent keeps its key, its downloaded documents and its receipts. */
export function resolveDataDir(configFile = null) {
  if (process.env.SMARTPRINT_DATA_DIR) return path.resolve(process.env.SMARTPRINT_DATA_DIR);
  if (configFile) return path.join(path.dirname(path.resolve(configFile)), 'data');
  return path.resolve('data');
}

export function configPath() {
  return path.resolve(process.env.SMARTPRINT_CONFIG ?? CONFIG_FILENAME);
}

/** Read the config file, returning null when it does not exist. */
export function readConfigFile(file = configPath()) {
  try {
    const raw = fs.readFileSync(file, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    // A corrupt config must be loud: silently falling back to "not registered"
    // would send the agent into a re-registration loop that duplicates machines.
    throw new Error(`Could not read ${file}: ${error.message}`);
  }
}

export function writeConfigFile(values, file = configPath()) {
  const payload = { ...values, updatedAt: new Date().toISOString() };
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  // 0600: the file holds an agent key that authorises printing.
  fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 });
  return file;
}

/**
 * Resolve the effective configuration.
 *
 * `printMode` defaults to `real` deliberately: silently simulating a print the
 * customer paid for would be the worst possible default.
 */
export function loadConfig({ file = configPath() } = {}) {
  const stored = readConfigFile(file) ?? {};

  const printMode = String(
    process.env.SMARTPRINT_PRINT_MODE ?? stored.printMode ?? 'real',
  ).toLowerCase();

  const config = {
    file,
    server: String(
      process.env.SMARTPRINT_SERVER ?? stored.server ?? 'http://localhost:5000',
    ).replace(/\/+$/, ''),
    agentId: process.env.SMARTPRINT_AGENT_ID ?? stored.agentId ?? null,
    agentKey: process.env.SMARTPRINT_AGENT_KEY ?? stored.agentKey ?? null,
    machineId: process.env.SMARTPRINT_MACHINE ?? stored.machineId ?? null,
    printMode: PRINT_MODES.includes(printMode) ? printMode : 'real',
    printerName: process.env.SMARTPRINT_PRINTER ?? stored.printerName ?? null,
    pollMs: toInt(process.env.SMARTPRINT_POLL_MS ?? stored.pollMs, 3000),
    heartbeatMs: toInt(process.env.SMARTPRINT_HEARTBEAT_MS ?? stored.heartbeatMs, 15_000),
    requestTimeoutMs: toInt(process.env.SMARTPRINT_TIMEOUT_MS ?? stored.requestTimeoutMs, 30_000),
    dataDir: resolveDataDir(stored ? file : null),
    hostname: os.hostname(),
    version: '1.0.0',
  };

  return config;
}

/** Everything the agent needs before it can run. */
export function assertRunnable(config) {
  const problems = [];
  if (!config.server) problems.push('server URL is missing');
  if (!config.agentId) problems.push('agentId is missing — run `npm run register`');
  if (!config.agentKey) problems.push('agentKey is missing — run `npm run register`');
  if (!config.machineId) problems.push('machineId is missing — run `npm run register`');

  if (problems.length) {
    const error = new Error(`The agent is not registered: ${problems.join('; ')}`);
    error.problems = problems;
    throw error;
  }

  return true;
}

export default { loadConfig, assertRunnable, readConfigFile, writeConfigFile, configPath };
