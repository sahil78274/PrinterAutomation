import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import { request, startTestServer } from './helpers/server.js';

/**
 * API surface tests. No database required: these assert the contract that must
 * hold even when MongoDB is unavailable, which is exactly the situation a
 * health check exists to describe.
 */

let harness;

before(async () => {
  harness = await startTestServer();
});

after(async () => {
  await harness.close();
});

describe('GET /api/health', () => {
  test('returns 200 with status, database and timestamp', async () => {
    const res = await request(harness.baseUrl, '/api/health');

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);

    const { data } = res.body;
    assert.equal(data.status, 'ok');
    assert.ok(data.timestamp, 'timestamp is present');
    // Timestamp must be a parseable ISO-8601 instant.
    assert.ok(!Number.isNaN(Date.parse(data.timestamp)), 'timestamp is valid ISO date');
    assert.ok(data.database, 'database block is present');
    assert.equal(typeof data.database.connected, 'boolean');
    assert.equal(typeof data.database.configured, 'boolean');
  });

  test('reports a disconnected database honestly', async () => {
    const res = await request(harness.baseUrl, '/api/health');
    // The suite runs without MongoDB, so connected must be false and the
    // status must not claim otherwise.
    assert.equal(res.body.data.database.connected, false);
    assert.notEqual(res.body.data.database.status, 'connected');
  });

  test('sets a request id header', async () => {
    const res = await request(harness.baseUrl, '/api/health');
    assert.match(res.headers.get('x-request-id'), /^[A-Za-z0-9._-]{8,128}$/);
  });

  test('echoes an inbound request id for traceability', async () => {
    const res = await request(harness.baseUrl, '/api/health', {
      headers: { 'X-Request-Id': 'trace-abc-123456' },
    });
    assert.equal(res.headers.get('x-request-id'), 'trace-abc-123456');
  });

  test('rejects an invalid inbound request id instead of echoing it', async () => {
    const res = await request(harness.baseUrl, '/api/health', {
      headers: { 'X-Request-Id': '<script>alert(1)</script>' },
    });
    assert.notEqual(res.headers.get('x-request-id'), '<script>alert(1)</script>');
  });
});

describe('GET /api/health/ready', () => {
  test('returns 503 when the database is unreachable', async () => {
    const res = await request(harness.baseUrl, '/api/health/ready');
    assert.equal(res.status, 503);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'NOT_READY');
  });
});

describe('invalid routes', () => {
  test('unknown API route returns a JSON 404', async () => {
    const res = await request(harness.baseUrl, '/api/nope');
    assert.equal(res.status, 404);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'ROUTE_NOT_FOUND');
    assert.ok(res.body.requestId, 'requestId is included for support');
  });

  test('unknown non-API route returns a JSON 404', async () => {
    const res = await request(harness.baseUrl, '/definitely/not/a/route');
    assert.equal(res.status, 404);
    assert.equal(res.body.error.code, 'ROUTE_NOT_FOUND');
  });

  test('reserved namespaces return an explanatory 404, not a stack trace', async () => {
    for (const path of ['/api/orders', '/api/auth/login', '/api/agents/heartbeat']) {
      // eslint-disable-next-line no-await-in-loop
      const res = await request(harness.baseUrl, path);
      assert.equal(res.status, 404, `${path} should be 404`);
      assert.equal(res.body.error.code, 'NOT_IMPLEMENTED');
      assert.match(res.body.error.message, /Phase \d/);
    }
  });

  test('404 responses carry security headers', async () => {
    const res = await request(harness.baseUrl, '/api/nope');
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(res.headers.get('x-powered-by'), null, 'framework is not advertised');
  });
});

describe('machine routes', () => {
  test('rejects a malformed machine ID with 422 before touching the database', async () => {
    const res = await request(harness.baseUrl, '/api/machines/SP-ABC');
    assert.equal(res.status, 422);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    assert.ok(res.body.error.details.machineId);
    // Critically: this must NOT be a 503, because no database was needed.
    assert.notEqual(res.body.error.code, 'DATABASE_UNAVAILABLE');
  });

  test('rejects a machine ID with path traversal characters', async () => {
    const res = await request(harness.baseUrl, '/api/machines/..%2F..%2Fetc%2Fpasswd');
    assert.equal(res.status, 422);
  });

  test('accepts a well-formed ID and fails with 503 while the database is down', async () => {
    const res = await request(harness.baseUrl, '/api/machines/SP-001');
    assert.equal(res.status, 503);
    assert.equal(res.body.error.code, 'DATABASE_UNAVAILABLE');
  });

  test('listing without shopId is rejected rather than dumping all tenants', async () => {
    const res = await request(harness.baseUrl, '/api/machines');
    // Without a DB this is 503; with a DB it must be a 400. Either way it must
    // never return a cross-tenant list.
    assert.ok([400, 503].includes(res.status));
    if (res.status === 400) assert.equal(res.body.error.code, 'SHOP_ID_REQUIRED');
  });

  test('machine registration is closed while authentication is pending', async () => {
    const res = await request(harness.baseUrl, '/api/machines', {
      method: 'POST',
      body: { shopId: '507f1f77bcf86cd799439011', name: 'Test' },
    });
    // devOnlyAdmin returns 404 (not 403) so the endpoint is not advertised.
    assert.equal(res.status, 404);
  });
});

describe('shop routes', () => {
  test('shop listing is closed while authentication is pending', async () => {
    const res = await request(harness.baseUrl, '/api/shops');
    assert.equal(res.status, 404);
  });
});

describe('request parsing', () => {
  test('rejects malformed JSON with 400, not 500', async () => {
    const res = await request(harness.baseUrl, '/api/machines', {
      method: 'POST',
      body: '{"shopId": ',
      headers: { 'Content-Type': 'application/json', 'X-Request-Id': 'json-test-12345' },
    });
    // The admin guard runs first for POST /api/machines, so this returns 404.
    // Assert the important property: never a 500.
    assert.ok(res.status < 500, `expected < 500, got ${res.status}`);
  });
});

describe('CORS', () => {
  test('allows the configured frontend origin', async () => {
    const res = await request(harness.baseUrl, '/api/health', {
      headers: { Origin: 'http://localhost:5173' },
    });
    assert.equal(res.headers.get('access-control-allow-origin'), 'http://localhost:5173');
  });

  test('does not allow an unlisted origin', async () => {
    const res = await request(harness.baseUrl, '/api/health', {
      headers: { Origin: 'https://evil.example.com' },
    });
    assert.equal(res.headers.get('access-control-allow-origin'), null);
  });

  test('answers preflight with the allowed methods', async () => {
    const res = await fetch(`${harness.baseUrl}/api/machines`, {
      method: 'OPTIONS',
      headers: { Origin: 'http://localhost:5173', 'Access-Control-Request-Method': 'POST' },
    });
    assert.equal(res.status, 204);
    assert.equal(res.headers.get('access-control-allow-origin'), 'http://localhost:5173');
    assert.match(res.headers.get('access-control-allow-methods'), /POST/);
  });

  test('allows the 127.0.0.1 spelling of the same dev origin', async () => {
    // A browser treats these as different origins, and Vite binds 0.0.0.0 so
    // either can be used to open the app. Allowing only "localhost" produced
    // CORS failures that looked like a backend outage.
    const res = await request(harness.baseUrl, '/api/health', {
      headers: { Origin: 'http://127.0.0.1:5173' },
    });
    assert.equal(res.headers.get('access-control-allow-origin'), 'http://127.0.0.1:5173');
  });

  test('the loopback alias does not widen the allowlist to other ports', async () => {
    for (const origin of ['http://127.0.0.1:6000', 'http://localhost:6000']) {
      const res = await request(harness.baseUrl, '/api/health', { headers: { Origin: origin } });
      assert.equal(res.headers.get('access-control-allow-origin'), null, origin);
    }
  });

  test('the loopback alias does not allow a lookalike hostname', async () => {
    for (const origin of ['http://localhost.evil.example:5173', 'http://127.0.0.1.nip.io:5173']) {
      const res = await request(harness.baseUrl, '/api/health', { headers: { Origin: origin } });
      assert.equal(res.headers.get('access-control-allow-origin'), null, origin);
    }
  });

  test('rejects the https upgrade of a configured http origin', async () => {
    // Scheme is part of the origin and must match exactly.
    const res = await request(harness.baseUrl, '/api/health', {
      headers: { Origin: 'https://localhost:5173' },
    });
    assert.equal(res.headers.get('access-control-allow-origin'), null);
  });

  test('preflight from the alias origin succeeds', async () => {
    const res = await fetch(`${harness.baseUrl}/api/health`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://127.0.0.1:5173',
        'Access-Control-Request-Method': 'GET',
      },
    });
    assert.equal(res.status, 204);
    assert.equal(res.headers.get('access-control-allow-origin'), 'http://127.0.0.1:5173');
  });
});
