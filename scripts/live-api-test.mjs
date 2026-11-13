/**
 * Live-API wiring test.
 *
 * Proves the seam between the mock service layer and the real Express API:
 *
 *   1. mock mode (default) still serves fully-populated demo data
 *   2. live mode hits the documented REST routes and unwraps the envelope
 *   3. a transport failure falls back to mock data instead of breaking a page
 *   4. a 4xx from the server is surfaced, not silently swallowed
 *
 * Runs without a browser and without a database: the API is expected to be
 * reachable at VITE_API_BASE_URL or http://127.0.0.1:5000. When it is not
 * running, the server-side checks are skipped with a clear message rather than
 * reported as failures.
 */
import { createServer } from 'vite';

const API_ORIGIN = process.env.VITE_API_PROXY || 'http://127.0.0.1:5000';

let pass = 0;
let fail = 0;
let skipped = 0;

function check(name, condition, detail = '') {
  if (condition) {
    pass += 1;
    console.log(`  ✓ ${name}`);
  } else {
    fail += 1;
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function skip(name, reason) {
  skipped += 1;
  console.log(`  – ${name} (skipped: ${reason})`);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function apiIsUp() {
  try {
    const response = await fetch(`${API_ORIGIN}/api/health`, {
      signal: AbortSignal.timeout(2500),
    });
    return response.ok;
  } catch {
    return false;
  }
}

// A Vite server in middleware mode gives us `import.meta.env` exactly as the
// real bundle sees it, so the live switch is tested through the same code path.
async function loadServices(apiBaseUrl, { liveData = false } = {}) {
  // `undefined` simulates the variable being absent entirely.
  // An empty string is a *real* configuration meaning "same origin".
  const server = await createServer({
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'error',
    define: {
      'import.meta.env.VITE_API_BASE_URL':
        apiBaseUrl === undefined ? 'undefined' : JSON.stringify(apiBaseUrl),
      'import.meta.env.VITE_API_LIVE_DATA': JSON.stringify(liveData ? 'true' : 'false'),
    },
  });

  const api = await server.ssrLoadModule('/src/services/api.js');
  const client = await server.ssrLoadModule('/src/services/apiClient.js');
  return { server, api, client };
}

const up = await apiIsUp();
console.log(`\nLive-API wiring test (API at ${API_ORIGIN}: ${up ? 'up' : 'down'})\n`);

/* -------------------------------------------------------------- mock mode --- */

console.log('Mock mode (VITE_API_LIVE_DATA not set)');
{
  const { server, api, client } = await loadServices(undefined);
  try {
    // Business endpoints stay on mock data until the routes exist and are
    // authenticated — independent of whether a dev API is reachable.
    check('isLiveMode is false', api.isLiveMode === false);
    // With the variable absent, development now defaults to the dev API origin.
    check(
      'base URL defaults to the dev API origin',
      client.resolveBaseUrl() === 'http://localhost:5000',
      client.resolveBaseUrl(),
    );

    const shops = await api.getShops();
    check('getShops returns seeded shops', Array.isArray(shops) && shops.length > 0);
    check(
      'getShops enriches machine counts',
      shops.every((shop) => typeof shop.machineCount === 'number'),
    );

    const machine = await api.getMachine('SP-001');
    check('getMachine resolves a seeded machine', machine?.id === 'SP-001');
    check('machine carries its shop context', Boolean(machine?.shop?.name));

    const missing = await api.getMachine('SP-999').catch((error) => error);
    check('unknown machine rejects with 404', missing?.status === 404);
  } finally {
    await server.close();
  }
}

/* -------------------------------------------------------------- live mode --- */

console.log('\nLive data mode (VITE_API_LIVE_DATA=true)');
{
  const { server, api } = await loadServices(API_ORIGIN, { liveData: true });
  try {
    check('isLiveMode is true', api.isLiveMode === true);

    if (!up) {
      skip('live requests', 'API is not running');
    } else {
      // /api/shops is admin-guarded and returns 404 without
      // ALLOW_ANONYMOUS_ADMIN, so this exercises the *error* path end to end.
      const guarded = await api.getShops().catch((error) => error);
      check(
        'guarded endpoint surfaces the server error, not mock data',
        guarded?.name === 'ApiClientError' && (guarded.status === 404 || guarded.status === 503),
        guarded?.message,
      );
      check(
        'server error carries a request id',
        typeof guarded?.requestId === 'string' && guarded.requestId.length > 0,
        `requestId=${guarded?.requestId}`,
      );
    }
  } finally {
    await server.close();
  }
}

/* --------------------------------------------------------------- fallback --- */

console.log('\nFallback (live mode, unreachable server)');
{
  // Port 59321 is deliberately closed.
  const { server, api } = await loadServices('http://127.0.0.1:59321', { liveData: true });
  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    const shops = await api.getShops();
    check('transport failure falls back to mock data', Array.isArray(shops) && shops.length > 0);

    const machine = await api.getMachine('SP-002');
    check('fallback works for machine lookup too', machine?.id === 'SP-002');
  } finally {
    console.warn = originalWarn;
    await server.close();
  }
}

/* ------------------------------------------------------ base URL resolution --- */

console.log('\nBase URL resolution');
{
  // Absent => dev default of http://localhost:5000, so the health call is a
  // visible cross-origin request in DevTools rather than a proxied one.
  {
    const { server, client } = await loadServices(undefined, { liveData: false });
    try {
      check(
        'absent base URL defaults to http://localhost:5000',
        client.resolveBaseUrl() === 'http://localhost:5000',
      );
    } finally {
      await server.close();
    }
  }

  // Explicit empty => same origin, the production/proxy configuration.
  {
    const { server, client } = await loadServices('');
    try {
      check('empty base URL resolves to same origin', client.resolveBaseUrl() === '');
    } finally {
      await server.close();
    }
  }

  // Explicit value wins and is trimmed of trailing slashes.
  {
    const { server, client } = await loadServices('http://api.example.test:8080///');
    try {
      check(
        'explicit base URL wins and is normalised',
        client.resolveBaseUrl() === 'http://api.example.test:8080',
      );
    } finally {
      await server.close();
    }
  }
}

/* ---------------------------------------------------------------- timeout --- */

console.log('\nError handling');
{
  // Point the client at a closed port so the transport really fails.
  const { server, client } = await loadServices('http://127.0.0.1:59322');
  try {
    // A relative path must resolve against the base URL, and an unreachable
    // host must produce a typed error rather than a hang. Uses the module's own
    // default origin (http://localhost:5000) with a port nothing listens on.
    const started = Date.now();
    const error = await client.request('/api/health', { timeoutMs: 800 }).catch((e) => e);
    const elapsed = Date.now() - started;

    check('unreachable host raises ApiClientError', error?.name === 'ApiClientError');
    check('error is a transport error', ['NETWORK_ERROR', 'TIMEOUT'].includes(error?.code));
    check('request does not hang past the timeout', elapsed < 3000, `${elapsed}ms`);
    check('transport errors are flagged as status 0', error?.status === 0);
  } finally {
    await sleep(50);
    await server.close();
  }
}

console.log(`\n${pass} passed, ${fail} failed, ${skipped} skipped`);
process.exit(fail === 0 ? 0 : 1);
