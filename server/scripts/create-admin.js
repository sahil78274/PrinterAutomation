#!/usr/bin/env node

/**
 * Create the first platform administrator via CLI.
 *
 * Usage:
 *   node scripts/create-admin.js --name "Admin Name" --email "admin@example.com" --password "SecurePass123"
 *
 *   Or interactively:
 *   node scripts/create-admin.js
 *
 * This script:
 *   - Connects to MongoDB
 *   - Validates inputs
 *   - Creates the admin user with a hashed password
 *   - Does NOT expose admin creation through any public API
 *
 * Prerequisites:
 *   - MONGODB_URI must be set in server/.env
 *   - bcryptjs must be installed
 *
 * Security:
 *   - Password is never logged or stored in plaintext
 *   - Requires direct server access to run
 *   - Cannot be called remotely through HTTP
 */

import readline from 'node:readline';
import { connectToDatabase, disconnectDatabase } from '../config/database.js';
import { getRepository } from '../repositories/active.js';
import { hashPassword, validatePassword } from '../services/passwordService.js';
import config from '../config/index.js';

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--name' && args[i + 1]) parsed.name = args[++i];
    else if (args[i] === '--email' && args[i + 1]) parsed.email = args[++i];
    else if (args[i] === '--password' && args[i + 1]) parsed.password = args[++i];
    else if (args[i] === '--help' || args[i] === '-h') {
      console.log(`
Usage: node scripts/create-admin.js [options]

Options:
  --name <name>       Admin full name
  --email <email>     Admin email address
  --password <pass>   Admin password (min 8 chars, must contain letter and number)
  --help, -h          Show this help message

If options are not provided, you will be prompted interactively.

Examples:
  node scripts/create-admin.js
  node scripts/create-admin.js --name "Admin" --email "admin@smartprint.in" --password "SecurePass1"
`);
      process.exit(0);
    }
  }
  return parsed;
}

// Interactive prompt using readline
function createPrompt() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return {
    question: (query) => new Promise((resolve) => rl.question(query, resolve)),
    close: () => rl.close(),
  };
}

// Hide password input
function createSecurePrompt() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    // Mute output while typing password
    process.stdout.write('Password: ');
    const stdin = process.openStdin();

    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }

    let password = '';
    const onData = (char) => {
      char = char.toString();

      if (char === '\n' || char === '\r' || char === '\u0004') {
        if (process.stdin.isTTY) {
          process.stdin.setRawMode(false);
        }
        stdin.removeListener('data', onData);
        process.stdout.write('\n');
        rl.close();
        resolve(password);
      } else if (char === '\u0003') {
        // Ctrl+C
        console.log('\nAborted.');
        process.exit(1);
      } else if (char === '\u007F' || char === '\b') {
        // Backspace
        if (password.length > 0) {
          password = password.slice(0, -1);
          process.stdout.write('\b \b');
        }
      } else {
        password += char;
        process.stdout.write('*');
      }
    };

    stdin.on('data', onData);
  });
}

async function main() {
  const args = parseArgs();
  let name, email, password;

  console.log('');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║         SmartPrint — Create Platform Administrator      ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');

  // Get inputs (from args or interactively)
  if (args.name && args.email && args.password) {
    name = args.name;
    email = args.email;
    password = args.password;
  } else {
    const prompt = createPrompt();

    try {
      name = args.name || await prompt.question('Admin name: ');
      email = args.email || await prompt.question('Admin email: ');
      password = args.password || await createSecurePrompt();
    } finally {
      prompt.close();
    }
  }

  // Validate inputs
  console.log('');
  console.log('Validating inputs...');

  if (!name || name.trim().length < 2) {
    console.error('Error: Name must be at least 2 characters.');
    process.exit(1);
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error('Error: Invalid email address.');
    process.exit(1);
  }

  const passwordIssues = validatePassword(password);
  if (passwordIssues.length > 0) {
    console.error('Error: Password does not meet requirements:');
    passwordIssues.forEach((issue) => console.error(`  - ${issue}`));
    process.exit(1);
  }

  // Check database configuration
  if (!config.mongo.uri) {
    console.error('Error: MONGODB_URI is not configured.');
    console.error('Please set MONGODB_URI in server/.env before running this script.');
    process.exit(1);
  }

  // Connect to database
  console.log('Connecting to database...');
  try {
    await connectToDatabase();
  } catch (error) {
    console.error('Error: Failed to connect to database.');
    console.error(error.message);
    process.exit(1);
  }

  try {
    const repo = getRepository();
    const normalisedEmail = email.trim().toLowerCase();

    // Check if admin already exists
    console.log('Checking for existing admin...');
    const existing = await repo.findOne('users', { email: normalisedEmail });
    if (existing) {
      console.log('');
      console.log(`An account with email "${normalisedEmail}" already exists.`);
      console.log(`Role: ${existing.role}`);
      console.log('');
      console.log('If you want to create a new admin with a different email, re-run this script.');
      await disconnectDatabase();
      process.exit(0);
    }

    // Create admin user
    console.log('Creating admin account...');
    const passwordHash = await hashPassword(password);

    const admin = await repo.insert('users', {
      name: name.trim(),
      email: normalisedEmail,
      passwordHash,
      role: 'admin',
      shopId: null,
      status: 'active',
      permissions: [],
      tokenVersion: 0,
      createdAt: new Date().toISOString(),
    });

    console.log('');
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║                 Admin created successfully!             ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`  ID:    ${admin.id}`);
    console.log(`  Name:  ${admin.name}`);
    console.log(`  Email: ${admin.email}`);
    console.log(`  Role:  ${admin.role}`);
    console.log(`  Status: ${admin.status}`);
    console.log('');
    console.log('You can now log in at the admin dashboard with these credentials.');
    console.log('');
    console.log('IMPORTANT: The password you entered has been securely hashed and');
    console.log('is not stored in plaintext. Do not forget it — use password reset');
    console.log('if needed.');
    console.log('');
  } catch (error) {
    console.error('Error creating admin:', error.message);
    process.exit(1);
  } finally {
    await disconnectDatabase();
  }
}

main().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
