#!/usr/bin/env node
/**
 * Diagnostic script for registration bug
 * 
 * This script:
 * 1. Checks if MongoDB is configured and connected
 * 2. Lists all existing users in the database
 * 3. Tests the registration flow with different emails
 * 4. Identifies if there's stale data causing the issue
 * 5. Provides fix recommendations
 * 
 * Usage: node scripts/diagnose-registration.js
 */

import mongoose from 'mongoose';
import config from '../config/index.js';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { getRepository } from '../repositories/active.js';
import * as authService from '../services/authService.js';
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

async function diagnose() {
  log(COLORS.cyan, '\n╔═══════════════════════════════════════════════════════════╗');
  log(COLORS.cyan, '║     SmartPrint Registration Bug Diagnostic Tool           ║');
  log(COLORS.cyan, '╚═══════════════════════════════════════════════════════════╝\n');

  // Step 1: Check configuration
  log(COLORS.blue, '📋 Step 1: Checking configuration...');
  log(COLORS.reset, `   MongoDB URI configured: ${config.mongo.uri ? 'YES' : 'NO'}`);
  
  if (!config.mongo.uri) {
    log(COLORS.yellow, '   ⚠️  MongoDB is NOT configured. Using in-memory repository.');
    log(COLORS.reset, '   This means data does not persist across server restarts.\n');
  } else {
    log(COLORS.green, '   ✓ MongoDB URI is configured');
    log(COLORS.reset, `   URI: ${config.mongo.uri.replace(/\/\/.*@/, '//<credentials>@')}\n`);
  }

  // Step 2: Connect to database
  log(COLORS.blue, '📋 Step 2: Connecting to database...');
  try {
    if (config.mongo.uri) {
      const state = await connectDatabase(logger);
      log(COLORS.green, `   ✓ Connected to MongoDB: ${state.name}`);
    } else {
      log(COLORS.yellow, '   ⚠️  Skipping MongoDB connection (not configured)');
    }
  } catch (error) {
    log(COLORS.red, `   ✗ Failed to connect: ${error.message}`);
    log(COLORS.reset, '   Continuing with in-memory repository...\n');
  }

  // Step 3: Check repository type
  const repo = getRepository();
  const repoType = repo.constructor?.name || 'Object';
  log(COLORS.blue, '\n📋 Step 3: Checking repository...');
  log(COLORS.reset, `   Repository type: ${repoType}`);
  
  if (repoType === 'Object') {
    // Memory repository
    log(COLORS.green, '   ✓ Using in-memory repository (normal when MongoDB not configured)');
  } else {
    log(COLORS.green, '   ✓ Using MongoDB repository');
  }

  // Step 4: List existing users
  log(COLORS.blue, '\n📋 Step 4: Checking existing users...');
  const users = await repo.findAll('users', {}, { includeDeleted: true });
  log(COLORS.reset, `   Total users in database: ${users.length}`);
  
  if (users.length > 0) {
    log(COLORS.reset, '\n   Existing users:');
    users.forEach((user, i) => {
      const deleted = user.deletedAt ? ' [DELETED]' : '';
      log(COLORS.reset, `   ${i + 1}. ${user.email} (ID: ${user.id})${deleted}`);
      log(COLORS.reset, `      Role: ${user.role}, Status: ${user.status}`);
    });
    
    if (users.length > 0 && !config.mongo.uri) {
      log(COLORS.yellow, '\n   ⚠️  WARNING: You have users in memory repository.');
      log(COLORS.reset, '   These will be lost when you restart the server.');
    }
  } else {
    log(COLORS.green, '   ✓ No existing users found');
  }

  // Step 5: Test registration flow
  log(COLORS.blue, '\n📋 Step 5: Testing registration flow...');
  
  const testEmails = [
    `test1.${Date.now()}@gmail.com`,
    `test2.${Date.now()}@gmail.com`,
    `test3.${Date.now()}@gmail.com`,
  ];
  
  let successCount = 0;
  let failCount = 0;
  
  for (let i = 0; i < testEmails.length; i++) {
    const email = testEmails[i];
    log(COLORS.reset, `\n   Test ${i + 1}: Registering with ${email}`);
    
    try {
      const result = await authService.registerShopOwner({
        name: `Test User ${i + 1}`,
        email: email,
        password: 'Test1234',
        phone: `98765432${10 + i}`,
        shopName: `Test Shop ${i + 1}`,
        address: `${100 + i} Test Street`,
        city: 'Hisar',
        state: 'Haryana',
        pincode: '125001',
        termsAccepted: true,
      });
      
      log(COLORS.green, `   ✓ Registration succeeded`);
      log(COLORS.reset, `     User ID: ${result.user.id}`);
      successCount++;
    } catch (error) {
      log(COLORS.red, `   ✗ Registration failed`);
      log(COLORS.reset, `     Error: ${error.message}`);
      log(COLORS.reset, `     Code: ${error.code}`);
      failCount++;
      
      if (error.code === 'EMAIL_TAKEN') {
        log(COLORS.red, `     ⚠️  BUG DETECTED: Email should be unique but is marked as taken!`);
      }
    }
  }

  // Step 6: Summary
  log(COLORS.cyan, '\n╔═══════════════════════════════════════════════════════════╗');
  log(COLORS.cyan, '║                    DIAGNOSIS SUMMARY                      ║');
  log(COLORS.cyan, '╚═══════════════════════════════════════════════════════════╝\n');
  
  log(COLORS.reset, `   Tests run: ${testEmails.length}`);
  log(COLORS.green, `   Successful: ${successCount}`);
  log(failCount > 0 ? COLORS.red : COLORS.reset, `   Failed: ${failCount}`);

  if (failCount > 0) {
    log(COLORS.red, '\n   ❌ BUG CONFIRMED: Registration is failing for unique emails!');
    log(COLORS.reset, '\n   Possible causes:');
    log(COLORS.reset, '   1. Corrupted MongoDB indexes');
    log(COLORS.reset, '   2. Stale data from previous tests');
    log(COLORS.reset, '   3. Email normalization issue');
    log(COLORS.reset, '\n   Recommended fix:');
    log(COLORS.yellow, '   Run: node scripts/fix-registration-bug.js');
  } else {
    log(COLORS.green, '\n   ✅ NO BUG DETECTED: Registration is working correctly!');
    log(COLORS.reset, '\n   If you\'re still seeing the error in your browser:');
    log(COLORS.reset, '   1. Clear your browser cache and cookies');
    log(COLORS.reset, '   2. Restart the server (Ctrl+C, then npm run dev)');
    log(COLORS.reset, '   3. Check the browser console for errors');
    log(COLORS.reset, '   4. Check the server logs for detailed error messages');
  }

  // Step 7: Final user count
  const finalUsers = await repo.findAll('users', {}, { includeDeleted: true });
  log(COLORS.reset, `\n   Final user count: ${finalUsers.length}`);

  // Cleanup
  if (config.mongo.uri) {
    await disconnectDatabase();
    log(COLORS.reset, '\n   Database connection closed.');
  }

  log(COLORS.cyan, '\n╚═══════════════════════════════════════════════════════════╝\n');
}

diagnose().catch((error) => {
  log(COLORS.red, `\n✗ Fatal error: ${error.message}`);
  console.error(error);
  process.exit(1);
});
