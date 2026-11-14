import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../app.js';
import { request } from './helpers/server.js';
import { getRepository } from '../repositories/active.js';
import { hashPassword } from '../services/passwordService.js';

/**
 * Regression test for login duplicate ID bug.
 *
 * This test reproduces the exact scenario:
 * 1. Register a shop owner (creates user + shop)
 * 2. Login with the same credentials
 * 3. Verify login succeeds without duplicate ID error
 *
 * The bug was that during login, when creating a refresh token,
 * the repository was somehow reusing an existing ID, causing a
 * MongoDB duplicate key error on the 'id' field.
 */

let harness;

test.before(async () => {
  const { startTestServer } = await import('./helpers/server.js');
  harness = await startTestServer();
});

test.after(async () => {
  if (harness) await harness.close();
});

test('login does not throw duplicate ID error after registration', async () => {
  const repo = getRepository();

  // Clean slate
  await repo.reset();

  // Step 1: Register a shop owner
  const registerResponse = await request(harness.baseUrl, '/api/auth/register', {
    method: 'POST',
    body: {
      name: 'Test Owner',
      email: 'test-login@example.com',
      password: 'TestPass123',
      shopName: 'Test Shop',
      phone: '9876543210',
      address: '123 Test St',
      city: 'TestCity',
      state: 'TestState',
      pincode: '123456',
      termsAccepted: true,
    },
  });

  assert.equal(registerResponse.status, 201, 'Registration should succeed');
  assert.ok(registerResponse.body.data.accessToken, 'Should receive access token');

  const userId = registerResponse.body.data.user.id;
  assert.ok(userId, 'User should have an ID');

  // Step 2: Login with the same credentials
  // This is where the bug occurred - duplicate ID error
  const loginResponse = await request(harness.baseUrl, '/api/auth/login', {
    method: 'POST',
    body: {
      email: 'test-login@example.com',
      password: 'TestPass123',
    },
  });

  // The bug would cause this to fail with 500 and "Duplicate value for id"
  assert.equal(loginResponse.status, 200, `Login should succeed, got ${loginResponse.status}: ${JSON.stringify(loginResponse.body)}`);
  assert.ok(loginResponse.body.data.accessToken, 'Login should return access token');
  assert.ok(loginResponse.body.data.refreshToken, 'Login should return refresh token');

  // Step 3: Verify the user ID is the same (we're logging in as the same user)
  assert.equal(loginResponse.body.data.user.id, userId, 'Should be the same user');

  // Step 4: Verify refresh token was created in database
  const refreshTokens = await repo.findAll('refreshTokens', { userId });
  assert.ok(refreshTokens.length >= 1, 'Should have at least one refresh token');

  // Step 5: Verify audit log was created
  const auditLogs = await repo.findAll('auditLogs', { entityId: userId, action: 'auth.login' });
  assert.ok(auditLogs.length >= 1, 'Should have audit log for login');

  // Step 6: Login again to ensure multiple logins work
  const loginResponse2 = await request(harness.baseUrl, '/api/auth/login', {
    method: 'POST',
    body: {
      email: 'test-login@example.com',
      password: 'TestPass123',
    },
  });

  assert.equal(loginResponse2.status, 200, 'Second login should also succeed');

  // Verify multiple refresh tokens exist
  const refreshTokens2 = await repo.findAll('refreshTokens', { userId });
  assert.ok(refreshTokens2.length >= 2, 'Should have multiple refresh tokens after multiple logins');
});

test('each inserted document gets a unique ID', async () => {
  const repo = getRepository();

  // Insert multiple documents and verify each gets a unique ID
  const ids = new Set();

  for (let i = 0; i < 5; i++) {
    const doc = await repo.insert('auditLogs', {
      action: 'test.action',
      entity: 'test',
      metadata: { iteration: i },
    });

    assert.ok(doc.id, `Document ${i} should have an ID`);
    assert.ok(!ids.has(doc.id), `Document ${i} ID should be unique, but ${doc.id} already exists`);
    ids.add(doc.id);
  }

  assert.equal(ids.size, 5, 'Should have 5 unique IDs');
});

test('refresh token insert generates unique IDs', async () => {
  const repo = getRepository();

  const userId = 'test-user-' + Date.now();
  const ids = new Set();

  // Simulate multiple login attempts
  for (let i = 0; i < 3; i++) {
    const token = await repo.insert('refreshTokens', {
      userId,
      tokenHash: `hash-${i}-${Date.now()}`,
      familyId: 'test-family',
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });

    assert.ok(token.id, `Token ${i} should have an ID`);
    assert.ok(!ids.has(token.id), `Token ${i} ID should be unique`);
    ids.add(token.id);
  }

  assert.equal(ids.size, 3, 'All refresh tokens should have unique IDs');
});
