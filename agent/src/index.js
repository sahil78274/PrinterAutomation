#!/usr/bin/env node
import process from 'node:process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

import { loadConfig, writeConfigFile, assertRunnable, configPath } from './config.js';
import { createApiClient } from './api.js';
import { createPrinter, isWindows } from './printer.js';
import { createWorker } from './worker.js';

/**
 * SmartPrint Local Print Agent — command line.
 *
 *   register   one-time pairing with the platform, prints the agent key once
 *   run        the work loop
 *   doctor     diagnose this machine without printing anything
 */

const HELP = `
SmartPrint Local Print Agent v1.0.0

Usage:
  smartprint-agent register --server <url> --machine <SP-001> --token <owner-token>
  smartprint-agent run
  smartprint-agent doctor
  smartprint-agent --help

Environment:
  SMARTPRINT_SERVER        API base URL
  SMARTPRINT_AGENT_ID      agent id (from register)
  SMARTPRINT_AGENT_KEY     agent key (from register)
  SMARTPRINT_PRINT_MODE    "real" (default) or "virtual" (simulated)
  SMARTPRINT_PRINTER       exact Windows printer name
  SMARTPRINT_CONFIG        path to agent.config.json

Virtual mode writes receipts to the data directory and prints nothing.
It is for development only.
`;

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token.startsWith('--')) {
      const key = token.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        args[key] = next;
        i += 1;
      } else {
        args[key] = true;
      }
    } else {
      args._.push(token);
    }
  }
  return args;
}

/** `register`: pair this machine and store its credentials. */
async function commandRegister(args) {
  const server = String(args.server ?? process.env.SMARTPRINT_SERVER ?? '').replace(/\/+$/, '');
  const machineId = String(args.machine ?? process.env.SMARTPRINT_MACHINE ?? '').toUpperCase();
  const token = args.token ?? process.env.SMARTPRINT_OWNER_TOKEN ?? '';
  const printMode = String(args['print-mode'] ?? process.env.SMARTPRINT_PRINT_MODE ?? 'virtual');

  if (!server) return fail('Missing --server (for example: http://localhost:5000)');
  if (!machineId)
    return fail('Missing --machine (the machine ID from the shop dashboard, e.g. SP-001)');
  if (!token) return fail('Missing --token (an owner access token from POST /api/auth/login)');

  console.log(`Registering this agent for ${machineId} at ${server} ...`);

  let response;
  try {
    response = await fetch(`${server}/api/agents/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'User-Agent': 'SmartPrintAgent/1.0',
      },
      body: JSON.stringify({
        machineId,
        name: `Agent on ${os.hostname()}`,
        printMode: printMode === 'real' ? 'real' : 'virtual',
      }),
    });
  } catch (error) {
    return fail(`Could not reach ${server}: ${error.message}`);
  }

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = payload?.error?.message ?? `Registration failed (${response.status})`;
    return fail(message);
  }

  const data = payload.data;
  const file = writeConfigFile({
    server,
    agentId: data.agent.agentId,
    agentKey: data.agentKey,
    machineId: data.agent.machineId ?? machineId,
    printMode: printMode === 'real' ? 'real' : 'virtual',
  });

  console.log('');
  console.log('  Registered successfully.');
  console.log('');
  console.log(`  Agent ID:  ${data.agent.agentId}`);
  console.log(`  Machine:   ${data.agent.machineId ?? machineId}`);
  console.log(`  Mode:      ${printMode === 'real' ? 'real printing' : 'VIRTUAL (simulated)'}`);
  console.log(`  Config:    ${file}`);
  console.log('');
  console.log('  AGENT KEY (shown once, save it now):');
  console.log('');
  console.log(`    ${data.agentKey}`);
  console.log('');
  console.log('  This key authorises printing on this machine. Keep the config file');
  console.log('  private. If it leaks, revoke the agent and register again.');
  console.log('');
  if (printMode !== 'real') {
    console.log('  Virtual mode is SIMULATED. Nothing will be sent to a printer.');
    console.log('');
  }
  return 0;
}

/** `doctor`: report what this machine can and cannot do, printing nothing. */
async function commandDoctor() {
  const config = loadConfig();
  const checks = [];

  const add = (name, ok, detail) => checks.push({ name, ok, detail });

  add('Node.js', Number(process.versions.node.split('.')[0]) >= 18, process.version);
  add('Platform', true, `${process.platform} (${os.arch()})`);
  add(
    'Real printing supported here',
    isWindows,
    isWindows ? 'Windows — spooler available' : 'Not Windows — real printing is unavailable',
  );
  add('Print mode', true, config.printMode === 'virtual' ? 'virtual (SIMULATED)' : 'real');

  add('Config file', fs.existsSync(configPath()), configPath());

  try {
    assertRunnable(config);
    add('Registration', true, `agent ${config.agentId.slice(0, 12)}…, machine ${config.machineId}`);
  } catch (error) {
    add('Registration', false, error.message);
  }

  if (config.agentId && config.agentKey) {
    const api = createApiClient({
      server: config.server,
      agentId: config.agentId,
      agentKey: config.agentKey,
      timeoutMs: 10_000,
    });
    try {
      await api.heartbeat({
        status: 'online',
        version: config.version,
        printMode: config.printMode,
      });
      add('Server reachable', true, config.server);
    } catch (error) {
      add('Server reachable', false, `${error.message} (${error.code})`);
    }
  } else {
    add('Server reachable', false, 'not registered yet');
  }

  if (config.printMode === 'real') {
    try {
      const printer = createPrinter(config);
      const description = await printer.describe();
      add(
        'Printer detected',
        description.available,
        description.printerName ?? 'no printer found — install one or set SMARTPRINT_PRINTER',
      );
    } catch (error) {
      add('Printer detected', false, error.message);
    }
  } else {
    add('Printer', true, 'not required in virtual mode');
  }

  console.log('\nSmartPrint Agent — diagnostics\n');
  for (const check of checks) {
    console.log(`  ${check.ok ? '[ok]  ' : '[FAIL]'} ${check.name}`);
    console.log(`         ${check.detail}`);
  }

  const failed = checks.filter((check) => !check.ok);
  console.log('');

  if (config.printMode === 'real') {
    console.log('  Real printing has NOT been verified by this command.');
    console.log('  Install a printer, then print one job and watch the paper come out.');
    console.log('');
  }

  if (failed.length) {
    console.log(`  ${failed.length} check(s) failed.`);
    return 1;
  }
  console.log('  All checks passed.');
  return 0;
}

/** `run`: the work loop, with graceful shutdown. */
async function commandRun() {
  const config = loadConfig();

  try {
    assertRunnable(config);
  } catch (error) {
    console.error(`\n  ${error.message}\n`);
    console.error(
      '  Run "npm run register -- --server <url> --machine <SP-001> --token <token>" first.\n',
    );
    return 1;
  }

  const api = createApiClient({
    server: config.server,
    agentId: config.agentId,
    agentKey: config.agentKey,
    timeoutMs: config.requestTimeoutMs,
  });
  const printer = createPrinter(config);
  const worker = createWorker({ config, api, printer });

  console.log(`\nSmartPrint Agent — ${config.machineId} @ ${config.server}`);
  if (config.printMode === 'virtual') {
    console.log('  MODE: VIRTUAL — jobs are SIMULATED. No paper will be printed.\n');
  } else {
    console.log('  MODE: REAL — jobs will be sent to the printer.\n');
  }

  let stopping = false;
  const shutdown = async (signal) => {
    if (stopping) return;
    stopping = true;
    console.log(`\n[agent] ${signal} received, finishing the current job ...`);
    await worker.stop();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  await worker.start();
  return 0;
}

function fail(message) {
  console.error(`\n  ${message}\n`);
  return 1;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0] ?? 'help';

  if (args.help || command === 'help') {
    console.log(HELP);
    return 0;
  }

  switch (command) {
    case 'register':
      return commandRegister(args);
    case 'run':
      return commandRun();
    case 'doctor':
      return commandDoctor();
    default:
      console.error(`Unknown command: ${command}`);
      console.log(HELP);
      return 1;
  }
}

// Only run when invoked directly, so the module can be imported by tests.
const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  main()
    .then((code) => process.exit(code ?? 0))
    .catch((error) => {
      console.error(`\n  ${error.message}\n`);
      process.exit(1);
    });
}

export { main, parseArgs, commandDoctor };
