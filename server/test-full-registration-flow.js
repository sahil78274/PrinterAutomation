/**
 * Full registration flow test
 * Tests the complete authService.registerShopOwner flow
 */

import * as authService from './services/authService.js';
import { getRepository } from './repositories/active.js';

async function testFullFlow() {
  console.log('=== Full Registration Flow Test ===\n');
  
  const repo = getRepository();
  console.log(`Using repository: ${repo.constructor.name}\n`);
  
  // Clear existing data (for testing only)
  await repo.reset();
  console.log('Cleared all data\n');
  
  // Test 1: First registration
  console.log('TEST 1: Register with unique email 1');
  try {
    const result1 = await authService.registerShopOwner({
      name: 'Test User 1',
      email: 'unique1@gmail.com',
      password: 'Test1234',
      phone: '9876543210',
      shopName: 'Test Shop 1',
      address: '123 Test St',
      city: 'Hisar',
      state: 'Haryana',
      pincode: '125001',
      termsAccepted: true,
    });
    console.log('✓ Registration succeeded');
    console.log(`  User ID: ${result1.user.id}`);
    console.log(`  User email: ${result1.user.email}`);
    console.log(`  Shop ID: ${result1.shop.id}\n`);
  } catch (error) {
    console.log('✗ Registration failed');
    console.log(`  Error: ${error.message}`);
    console.log(`  Code: ${error.code}\n`);
  }
  
  // Test 2: Second registration with different email
  console.log('TEST 2: Register with unique email 2');
  try {
    const result2 = await authService.registerShopOwner({
      name: 'Test User 2',
      email: 'unique2@gmail.com',
      password: 'Test1234',
      phone: '9876543211',
      shopName: 'Test Shop 2',
      address: '456 Test Ave',
      city: 'Hisar',
      state: 'Haryana',
      pincode: '125002',
      termsAccepted: true,
    });
    console.log('✓ Registration succeeded');
    console.log(`  User ID: ${result2.user.id}`);
    console.log(`  User email: ${result2.user.email}`);
    console.log(`  Shop ID: ${result2.shop.id}\n`);
  } catch (error) {
    console.log('✗ Registration failed');
    console.log(`  Error: ${error.message}`);
    console.log(`  Code: ${error.code}`);
    console.log(`  This is the BUG!\n`);
  }
  
  // Test 3: Try to register with duplicate email
  console.log('TEST 3: Try to register with duplicate email (should fail)');
  try {
    await authService.registerShopOwner({
      name: 'Test User 3',
      email: 'unique1@gmail.com', // Same as test 1
      password: 'Test1234',
      phone: '9876543212',
      shopName: 'Test Shop 3',
      address: '789 Test Blvd',
      city: 'Hisar',
      state: 'Haryana',
      pincode: '125003',
      termsAccepted: true,
    });
    console.log('✗ Registration succeeded (SHOULD HAVE FAILED!)\n');
  } catch (error) {
    console.log('✓ Registration correctly failed');
    console.log(`  Error: ${error.message}`);
    console.log(`  Code: ${error.code}\n`);
  }
  
  // Check database state
  console.log('Database state:');
  const users = await repo.findAll('users');
  console.log(`  Total users: ${users.length}`);
  users.forEach(u => {
    console.log(`    - ${u.email} (ID: ${u.id})`);
  });
  
  console.log('\n=== Test Complete ===');
}

testFullFlow().catch(console.error);
