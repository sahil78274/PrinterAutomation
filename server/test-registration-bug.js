/**
 * Diagnostic script to reproduce the registration bug
 * Run with: node test-registration-bug.js
 */

import { createMemoryRepository } from './repositories/memoryRepository.js';

async function testRegistration() {
  console.log('=== Registration Bug Diagnostic ===\n');
  
  const repo = createMemoryRepository();
  
  // Simulate first registration
  console.log('1. First registration with test1@example.com');
  const email1 = 'test1@example.com';
  const normalizedEmail1 = String(email1).trim().toLowerCase();
  console.log(`   Normalized email: "${normalizedEmail1}"`);
  
  const existingUser1 = await repo.findOne('users', { email: normalizedEmail1 }, { includeDeleted: true });
  console.log(`   Existing user found: ${existingUser1 ? 'YES' : 'NO'}`);
  
  if (existingUser1) {
    console.log(`   ERROR: User found when it should not exist!`);
    console.log(`   User data:`, existingUser1);
  }
  
  // Create the user
  const user1 = await repo.insert('users', {
    name: 'Test User 1',
    email: normalizedEmail1,
    passwordHash: 'hashed_password',
    role: 'shop',
    shopId: 'shop1',
    status: 'active',
  });
  console.log(`   User created with ID: ${user1.id}`);
  console.log(`   User email stored: "${user1.email}"`);
  
  // Check what's in the database
  const allUsers = await repo.findAll('users');
  console.log(`   Total users in DB: ${allUsers.length}`);
  console.log(`   Users:`, allUsers.map(u => ({ id: u.id, email: u.email })));
  
  console.log('\n2. Second registration with test2@example.com');
  const email2 = 'test2@example.com';
  const normalizedEmail2 = String(email2).trim().toLowerCase();
  console.log(`   Normalized email: "${normalizedEmail2}"`);
  
  const existingUser2 = await repo.findOne('users', { email: normalizedEmail2 }, { includeDeleted: true });
  console.log(`   Existing user found: ${existingUser2 ? 'YES' : 'NO'}`);
  
  if (existingUser2) {
    console.log(`   ERROR: User found when it should not exist!`);
    console.log(`   User data:`, existingUser2);
    console.log(`   This is the BUG!`);
  } else {
    console.log(`   Correct: No existing user found`);
  }
  
  // Test with exact match
  console.log('\n3. Testing exact email matching');
  const testEmail = 'test2@example.com';
  const found = await repo.findOne('users', { email: testEmail });
  console.log(`   Looking for "${testEmail}": ${found ? 'FOUND' : 'NOT FOUND'}`);
  
  // Test case sensitivity
  console.log('\n4. Testing case sensitivity');
  const upperEmail = 'TEST1@EXAMPLE.COM';
  const foundUpper = await repo.findOne('users', { email: upperEmail });
  console.log(`   Looking for "${upperEmail}": ${foundUpper ? 'FOUND (BUG!)' : 'NOT FOUND (correct)'}`);
  
  console.log('\n=== Test Complete ===');
}

testRegistration().catch(console.error);
