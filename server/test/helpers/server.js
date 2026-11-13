import http from 'node:http';
import { createApp } from '../../app.js';

/**
 * Test harness: boots the Express app on an ephemeral port so every test file
 * gets a real HTTP server without port collisions.
 *
 * Deliberately does NOT connect to MongoDB. Individual tests assert the
 * disconnected behaviour; DB-backed behaviour is covered separately by the
 * integration test, which skips itself when no database is reachable.
 */
export async function startTestServer({ env = {} } = {}) {
  Object.assign(process.env, env);
  process.env.NODE_ENV = process.env.NODE_ENV || 'test';

  const app = createApp();
  const server = http.createServer(app);

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();

  return {
    app,
    server,
    port,
    baseUrl: `http://127.0.0.1:${port}`,
    async close() {
      await new Promise((resolve) => server.close(resolve));
    },
  };
}

/**
 * Minimal fetch-based request helper returning status, headers and parsed JSON.
 */
export async function request(baseUrl, path, options = {}) {
  const { method = 'GET', body, headers = {} } = options;

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}),
  });

  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  return {
    status: response.status,
    headers: response.headers,
    body: json,
    text,
  };
}
