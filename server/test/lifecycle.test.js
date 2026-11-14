import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { startTestServer, request } from './helpers/server.js';
import { validateConfig } from '../config/index.js';
import config from '../config/index.js';

const execFileAsync = promisify(execFile);

/** Import the config module in a clean process so env changes are real. */
async function validateConfigInFreshProcess(env) {
  const script = `
    const { validateConfig } = await import('./config/index.js');
    try {
      const warnings = validateConfig({ requireMongo: true });
      console.log(JSON.stringify({ ok: true, warnings }));
    } catch (error) {
      console.log(JSON.stringify({ ok: false, message: error.message }));
    }
  `;
  const { stdout } = await execFileAsync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: new URL('..', import.meta.url).pathname,
    env: { ...process.env, ...env },
  });
  return JSON.parse(stdout.trim().split('\n').pop());
}

/**
 * Application lifecycle and process-level behaviour: configuration validation,
 * the error envelope under unusual inputs, and graceful shutdown.
 *
 * These deliberately run against a server that has no database, which is the
 * situation an operator is most likely to hit in production and the one most
 * likely to be mishandled (either by crashing or by hanging).
 */

let server;

before(async () => {
  server = await startTestServer();
});

after(async () => {
  await server.close();
});

describe('configuration validation', () => {
  test('returns warnings rather than throwing for a usable config', () => {
    assert.ok(Array.isArray(validateConfig({ requireMongo: false })));
  });

  test('the current environment is internally consistent', () => {
    assert.ok(config.server.port > 0);
    assert.ok(config.cors.origins.length > 0);
    assert.ok(['development', 'test', 'production'].includes(config.env));
  });

  test('a missing MONGODB_URI is fatal only when a database is required', async () => {
    // Empty string, not deleted: dotenv will not re-populate an existing key
    // from .env, so the value genuinely stays empty in the child process.
    const result = await validateConfigInFreshProcess({ MONGODB_URI: '' });
    assert.equal(result.ok, false);
    assert.match(result.message, /MONGODB_URI/);
  });

  test('a non-mongodb URI is rejected', async () => {
    const result = await validateConfigInFreshProcess({ MONGODB_URI: 'postgres://localhost/db' });
    assert.equal(result.ok, false);
    assert.match(result.message, /mongodb:\/\//);
  });

  test('a valid URI passes', async () => {
    const result = await validateConfigInFreshProcess({
      MONGODB_URI: 'mongodb://127.0.0.1:27017/smartprint',
    });
    assert.equal(result.ok, true);
  });

  test('a wildcard CORS origin is refused in production', async () => {
    const result = await validateConfigInFreshProcess({
      NODE_ENV: 'production',
      CLIENT_URL: '*',
      MONGODB_URI: 'mongodb://127.0.0.1:27017/smartprint',
    });
    assert.equal(result.ok, false);
    assert.match(result.message, /Wildcard CORS/);
  });

  test('an empty CLIENT_URL is refused in production', async () => {
    const result = await validateConfigInFreshProcess({
      NODE_ENV: 'production',
      CLIENT_URL: '',
      MONGODB_URI: 'mongodb://127.0.0.1:27017/smartprint',
    });
    assert.equal(result.ok, false);
    assert.match(result.message, /CLIENT_URL/);
  });

  test('an empty CLIENT_URL falls back to localhost in development', async () => {
    const result = await validateConfigInFreshProcess({
      NODE_ENV: 'development',
      CLIENT_URL: '',
      MONGODB_URI: 'mongodb://127.0.0.1:27017/smartprint_test',
    });
    assert.equal(result.ok, true);
  });
});

describe('error envelope integrity', () => {
  test('every failure has the same shape', async () => {
    const paths = [
      ['GET', '/api/does-not-exist'],
      ['GET', '/api/machines/NOT-AN-ID'],
      ['POST', '/api/machines'],
      ['DELETE', '/api/health'],
    ];

    for (const [method, path] of paths) {
      const response = await request(server.baseUrl, path, { method });
      assert.equal(response.body?.success, false, `${method} ${path} should fail`);
      assert.equal(typeof response.body?.error?.code, 'string', `${method} ${path} needs a code`);
      assert.equal(typeof response.body?.error?.message, 'string');
      assert.equal(typeof response.body?.requestId, 'string');
      assert.equal('data' in response.body, false);
    }
  });

  test('request ids are unique per request', async () => {
    const a = await request(server.baseUrl, '/api/health');
    const b = await request(server.baseUrl, '/api/health');
    assert.notEqual(
      a.body.requestId ?? a.headers.get('x-request-id'),
      b.body.requestId ?? b.headers.get('x-request-id'),
    );
  });

  test('a malformed JSON body is a 400, not a 500', async () => {
    const response = await request(server.baseUrl, '/api/machines', {
      method: 'POST',
      body: '{"shopId": ',
      headers: { 'Content-Type': 'application/json' },
    });
    assert.equal(response.status, 400);
    assert.equal(response.body.error.code, 'INVALID_JSON');
  });

  test('a deeply nested body is rejected without crashing', async () => {
    // A 200-deep JSON body must be refused by the parser before any handler runs.
    // Authentication now runs first on /api/machines, so this asserts on any
    // 4xx rather than a specific one — the point is that nothing returns 500.
    let nested = 'null';
    for (let i = 0; i < 200; i += 1) nested = `{"a":${nested}}`;

    const response = await request(server.baseUrl, '/api/machines', {
      method: 'POST',
      body: nested,
    });

    assert.ok(
      [400, 401, 413, 422].includes(response.status),
      `unexpected status ${response.status}`,
    );
    assert.equal(response.body.success, false);
    assert.equal(typeof response.body.error.code, 'string');
  });

  test('an unauthenticated write is refused before its body is validated', async () => {
    // The route must disclose nothing to an anonymous caller: not the schema,
    // not the field names. 401 comes first, so no validation detail leaks.
    const response = await request(server.baseUrl, '/api/machines', {
      method: 'POST',
      body: {},
    });

    assert.equal(response.status, 401);
    assert.notEqual(response.body.error.code, 'VALIDATION_ERROR');
    assert.equal(response.body.error.details, undefined);
  });

  test('error messages never contain a stack trace', async () => {
    const response = await request(server.baseUrl, '/api/machines/SP-001');
    const serialised = JSON.stringify(response.body);
    assert.equal(/at [\w.<>]+ \(/.test(serialised), false, 'stack frame leaked into the response');
    assert.equal(serialised.includes('node_modules'), false);
  });
});

describe('security headers', () => {
  test('are present on API responses', async () => {
    const response = await request(server.baseUrl, '/api/health');
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(response.headers.get('x-powered-by'), null);
    assert.ok(response.headers.get('referrer-policy'));
  });

  test('are present on 404s too', async () => {
    const response = await request(server.baseUrl, '/api/nope');
    assert.equal(response.headers.get('x-powered-by'), null);
    assert.ok(response.headers.get('x-content-type-options'));
  });
});

describe('graceful shutdown', () => {
  test('closes the listener and stops accepting connections', async () => {
    const isolated = await startTestServer();
    const url = `${isolated.baseUrl}/api/health`;

    const before = await request(isolated.baseUrl, '/api/health');
    assert.equal(before.status, 200);

    await isolated.close();

    await assert.rejects(() => fetch(url, { signal: AbortSignal.timeout(1500) }));
  });

  test('closing is idempotent-safe — a second close does not throw synchronously', async () => {
    const isolated = await startTestServer();
    await isolated.close();
    // node:http resolves close() for an already-closed server rather than
    // throwing; asserting this documents the behaviour shutdown relies on.
    await assert.doesNotReject(() => isolated.close());
  });
});

describe('process resilience', () => {
  test('an unhandled route never blocks the event loop', async () => {
    const responses = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        request(server.baseUrl, i % 2 === 0 ? '/api/health' : '/api/missing'),
      ),
    );
    assert.equal(responses.filter((r) => r.status === 200).length, 10);
    assert.equal(responses.filter((r) => r.status === 404).length, 10);
  });

  test('head requests are answered without a body', async () => {
    const response = await request(server.baseUrl, '/api/health', { method: 'HEAD' });
    assert.equal(response.status, 200);
    assert.equal(response.text, '');
  });

  test('responses are JSON, never HTML', async () => {
    const response = await request(server.baseUrl, '/api/nope');
    assert.match(response.headers.get('content-type') ?? '', /application\/json/);
  });
});
