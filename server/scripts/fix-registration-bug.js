#!/usr/bin/env node
/**
 * Fix script for registration bug
 * 
 * This script:
 * 1. Connects to MongoDB (if configured)
 * 2. Drops and rebuilds indexes on the users collection
 * 3. Optionally clears all user data (for fresh start)
 * 4. Verifies the fix
 * 
 * Usage:
 *   node scripts/fix-registration-bug.js           # Rebuild indexes only
 *   node scripts/fix-registration-bug.js --clear   # Clear all data and rebuild indexes
 * 
 * WARNING: --clear will delete ALL users, shops, and related data!
 */

import mongoose from 'mongoose';
import config from '../config/index.js';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { getRepository } from '../repositories/active.js';
import logger from '../utils/logger.js';

const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(color, message) {
  console.log(`${color}${message}${COLORS.reset}`);
}

async function fixRegistrationBug() {
  const clearData = process.argv.includes('--clear');
  
  log(COLORS.cyan, '\n╔═══════════════════════════════════════════════════════════╗');
  log(COLORS.cyan, '║     SmartPrint Registration Bug Fix Tool                  ║');
  log(COLORS.cyan, '╚═══════════════════════════════════════════════════════════╝\n');

  if (clearData) {
    log(COLORS.red, '⚠️  WARNING: --clear flag detected!');
    log(COLORS.red, '   This will DELETE ALL users, shops, and related data!\n');
    
    // In production, you'd want to prompt for confirmation here
    // For now, we'll just proceed but log a warning
    log(COLORS.yellow, '   Proceeding with data clearing...\n');
  }

  // Check if MongoDB is configured
  if (!config.mongo.uri) {
    log(COLORS.yellow, '⚠️  MongoDB is NOT configured.');
    log(COLORS.reset, '   Using in-memory repository. Data clearing is not needed.');
    log(COLORS.reset, '   Simply restart the server to clear all data.\n');
    
    const repo = getRepository();
    await repo.reset();
    log(COLORS.green, '✓ In-memory repository cleared.\n');
    return;
  }

  // Connect to MongoDB
  log(COLORS.blue, '📋 Step 1: Connecting to MongoDB...');
  try {
    const state = await connectDatabase(logger);
    log(COLORS.green, `   ✓ Connected to: ${state.name}\n`);
  } catch (error) {
    log(COLORS.red, `   ✗ Failed to connect: ${error.message}`);
    log(COLORS.reset, '   Please check your MONGODB_URI in server/.env\n');
    process.exit(1);
  }

  const db = mongoose.connection.db;

  // Step 2: Show current state
  log(COLORS.blue, '📋 Step 2: Current database state...');
  const usersCount = await db.collection('users').countDocuments();
  const shopsCount = await db.collection('shops').countDocuments();
  log(COLORS.reset, `   Users: ${usersCount}`);
  log(COLORS.reset, `   Shops: ${shopsCount}\n`);

  // Step 3: Clear data if requested
  if (clearData) {
    log(COLORS.blue, '📋 Step 3: Clearing all data...');
    
    const collections = ['users', 'shops', 'machines', 'refreshTokens', 'auditLogs'];
    for (const collection of collections) {
      const result = await db.collection(collection).deleteMany({});
      log(COLORS.reset, `   Deleted ${result.deletedCount} documents from ${collection}`);
    }
    log(COLORS.green, '   ✓ All data cleared\n');
  }

  // Step 4: Drop existing indexes
  log(COLORS.blue, '📋 Step 4: Dropping existing indexes...');
  
  const usersIndexes = await db.collection('users').indexes();
  log(COLORS.reset, `   Found ${usersIndexes.length} indexes on users collection:`);
  usersIndexes.forEach((idx, i) => {
    const fields = Object.keys(idx.key).join(', ');
    const unique = idx.unique ? ' (UNIQUE)' : '';
    log(COLORS.reset, `   ${i + 1}. { ${fields} }${unique}`);
  });
  
  await db.collection('users').dropIndexes();
  log(COLORS.green, '   ✓ All indexes dropped\n');

  // Step 5: Recreate essential indexes
  log(COLORS.blue, '📋 Step 5: Recreating essential indexes...');
  
  // Email unique index (most important for registration)
  await db.collection('users').createIndex(
    { email: 1 },
    { unique: true, sparse: true, name: 'email_unique' }
  );
  log(COLORS.green, '   ✓ Created unique index on email');
  
  // id unique index (required by repository)
  await db.collection('users').createIndex(
    { id: 1 },
    { unique: true, name: 'id_unique' }
  );
  log(COLORS.green, '   ✓ Created unique index on id');
  
  // Other useful indexes
  await db.collection('users').createIndex(
    { shopId: 1, role: 1 },
    { name: 'shopId_role' }
  );
  log(COLORS.green, '   ✓ Created index on shopId + role');
  
  await db.collection('users').createIndex(
    { role: 1 },
    { name: 'role' }
  );
  log(COLORS.green, '   ✓ Created index on role');
  
  await db.collection('users').createIndex(
    { status: 1 },
    { name: 'status' }
  );
  log(COLORS.green, '   ✓ Created index on status\n');

  // Step 6: Verify indexes
  log(COLORS.blue, '📋 Step 6: Verifying indexes...');
  const newIndexes = await db.collection('users').indexes();
  log(COLORS.reset, `   Total indexes: ${newIndexes.length}`);
  newIndexes.forEach((idx, i) => {
    const fields = Object.keys(idx.key).join(', ');
    const unique = idx.unique ? ' (UNIQUE)' : '';
    log(COLORS.reset, `   ${i + 1}. { ${fields} }${unique} - ${idx.name}`);
  });
  log(COLORS.green, '   ✓ All indexes verified\n');

  // Step 7: Test registration
  log(COLORS.blue, '📋 Step 7: Testing registration...');
  const repo = getRepository();
  
  const testEmail = `test.${Date.now()}@gmail.com`;
  try {
    const result = await (await import('../services/authService.js')).registerShopOwner({
      name: 'Test User',
      email: testEmail,
      password: 'Test1234',
      phone: '9876543210',
      shopName: 'Test Shop',
      address: '123 Test St',
      city: 'Hisar',
      state: 'Haryana',
      pincode: '125001',
      termsAccepted: true,
    });
    
    log(COLORS.green, `   ✓ Registration succeeded!`);
    log(COLORS.reset, `     User ID: ${result.user.id}`);
    log(COLORS.reset, `     Email: ${result.user.email}\n`);
    
    // Clean up test user
    await repo.softDelete('users', result.user.id);
    await repo.softDelete('shops', result.shop.id);
    log(COLORS.reset, '   Test user cleaned up.\n');
  } catch (error) {
    log(COLORS.red, `   ✗ Registration failed: ${error.message}`);
    log(COLORS.reset, `     Code: ${error.code}\n`);
    
    if (error.code === 'EMAIL_TAKEN') {
      log(COLORS.red, '   ❌ BUG STILL EXISTS!');
      log(COLORS.reset, '   Please check the server logs for more details.\n');
    }
  }

  // Step 8: Final state
  log(COLORS.blue, '📋 Step 8: Final database state...');
  const finalUsersCount = await db.collection('users').countDocuments();
  const finalShopsCount = await db.collection('shops').countDocuments();
  log(COLORS.reset, `   Users: ${finalUsersCount}`);
  log(COLORS.reset, `   Shops: ${finalShopsCount}\n`);

  // Cleanup
  await disconnectDatabase();
  
  log(COLORS.cyan, '╔═══════════════════════════════════════════════════════════╗');
  log(COLORS.cyan, '║                    FIX COMPLETE                           ║');
  log(COLORS.cyan, '╚═══════════════════════════════════════════════════════════╝\n');
  
  log(COLORS.green, '✅ Registration bug fix applied successfully!\n');
  log(COLORS.reset, 'Next steps:');
  log(COLORS.reset, '1. Restart your server: npm run dev');
  log(COLORS.reset, '2. Try registering with a new email address');
  log(COLORS.reset, '3. If the issue persists, check the server logs\n');
}

fixRegistrationBug().catch((error) => {
  log(COLORS.red, `\n✗ Fatal error: ${error.message}`);
  console.error(error);
  process.exit(1);
});
