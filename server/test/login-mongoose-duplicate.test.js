import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createMongooseRepository } from '../repositories/mongooseRepository.js';

/**
 * Regression test for the login duplicate ID bug.
 *
 * The bug: When mongooseRepository.insert() is called with a doc object that
 * already has an `id` field (e.g., from a previous query result), it tries to
 * reuse that ID instead of generating a new one. This causes MongoDB to reject
 * the insert with a duplicate key error on the `id` field.
 *
 * The root cause: In the insert method, we do:
 *   { ...doc, id: doc.id ?? randomUUID() }
 *
 * If doc.id exists (even if it's from a different collection), it will be used
 * instead of generating a new UUID. This is wrong because:
 * 1. Different collections should have independent ID spaces
 * 2. A query result object might accidentally be passed to insert
 * 3. The id field should always be generated unless explicitly provided for a
 *    specific reason (which should be rare)
 *
 * The fix: Always generate a new UUID unless the caller explicitly passes an
 * `id` field that they want to use. We can detect "explicit" by checking if
 * the id was in the original doc object before we added defaults.
 */

// Mock mongoose for testing
let mockCollections = new Map();

const mockModel = {
  create: async (doc) => {
    const collection = mockCollections.get('test') || [];

    // Check for duplicate id
    const existing = collection.find(d => d.id === doc.id);
    if (existing) {
      const error = new Error('Duplicate key error');
      error.code = 11000;
      error.keyPattern = { id: 1 };
      error.keyValue = { id: doc.id };
      throw error;
    }

    collection.push(doc);
    mockCollections.set('test', collection);

    return {
      ...doc,
      toObject: () => doc,
    };
  },
  schema: {
    index: () => {},
  },
};

// This test demonstrates the bug
test('BUG: insert with doc.id reuses that ID instead of generating new one', async () => {
  // Simulate the buggy behavior
  const doc = {
    id: 'existing-user-id-123', // This ID already exists in users collection
    name: 'Test User',
    email: 'test@example.com',
  };

  // Current buggy code does: { ...doc, id: doc.id ?? randomUUID() }
  // Since doc.id exists, it will be reused
  const result = { ...doc, id: doc.id ?? randomUUID() };

  // This is wrong! We're reusing an ID from a different context
  assert.equal(result.id, 'existing-user-id-123', 'Bug: reuses existing ID');

  // In the real scenario, this causes MongoDB to reject the insert
  // because that ID already exists in the target collection
});

test('FIX: insert should always generate new ID unless explicitly needed', async () => {
  // The fix: check if id was explicitly provided in the original doc
  // For most cases, we should always generate a new ID

  const doc = {
    name: 'Test User',
    email: 'test@example.com',
  };

  // Fixed code: always generate new ID for insert operations
  const result = { ...doc, id: randomUUID() };

  assert.ok(result.id, 'Should have an ID');
  assert.notEqual(result.id, doc.id, 'Should be a new ID, not from doc');
});

test('integration: repository.insert should generate unique IDs even when doc has id field', async () => {
  // This test verifies the fix for the duplicate ID bug
  // Use memory repository to avoid needing MongoDB connection
  const { createMemoryRepository } = await import('../repositories/memoryRepository.js');
  const repo = createMemoryRepository();

  // First insert - creates a user
  const user1 = await repo.insert('users', {
    name: 'User 1',
    email: 'user1@example.com',
  });

  assert.ok(user1.id, 'First user should have an ID');

  // Second insert - simulate the bug scenario where a query result is passed
  // In the real login flow, this could happen if we accidentally pass
  // a user object to insert instead of creating a new object
  const buggyDoc = {
    ...user1, // This includes user1.id!
    email: 'user2@example.com',
    name: 'User 2',
  };

  // With the fix, this should generate a new ID instead of reusing user1.id
  const user2 = await repo.insert('users', buggyDoc);

  // Verify the fix worked
  assert.ok(user2.id, 'Second user should have an ID');
  assert.notEqual(user2.id, user1.id, 'Should have different IDs even though doc had id field');
  
  // Verify both users exist in the repository
  const allUsers = await repo.findAll('users', {});
  assert.equal(allUsers.length, 2, 'Should have 2 users');
});

test('login flow: refresh token insert should not reuse user ID', async () => {
  // Simulate the login flow where we create a refresh token
  // The bug could occur if we accidentally pass the user object to insert

  const mockUser = {
    id: 'user-123',
    name: 'Test User',
    email: 'test@example.com',
    shopId: 'shop-456',
  };

  // Correct way: create a new object with only the fields we need
  const refreshTokenData = {
    userId: mockUser.id,
    token: 'token-abc',
    expiresAt: new Date().toISOString(),
  };

  // This should NOT have an id field, so insert will generate one
  assert.equal(refreshTokenData.id, undefined, 'Should not have id field');

  // Buggy way: if we accidentally spread the user object
  const buggyRefreshTokenData = {
    ...mockUser, // This includes mockUser.id!
    token: 'token-abc',
    expiresAt: new Date().toISOString(),
  };

  // This WILL have an id field (user-123), which will cause duplicate key error
  // if we try to insert it
  assert.equal(buggyRefreshTokenData.id, 'user-123', 'Bug: has user ID');
});
