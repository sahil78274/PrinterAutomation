import bcrypt from 'bcryptjs';
import { randomBytes, createHash } from 'node:crypto';
import config from '../config/index.js';
import ApiError from '../utils/ApiError.js';

/**
 * Password and token-secret handling.
 *
 * Passwords use bcrypt with a per-hash salt. Refresh tokens are *not* stored —
 * only a SHA-256 digest is persisted, so a database leak does not hand an
 * attacker usable sessions.
 */

const MIN_LENGTH = 8;
const MAX_LENGTH = 72; // bcrypt truncates beyond 72 bytes; reject rather than surprise.

/**
 * Password policy, deliberately pragmatic: length and variety beat
 * unguessable symbol soup that users write on a sticky note.
 * Returns an array of human-readable problems (empty when acceptable).
 */
export function validatePassword(password) {
  const problems = [];
  const value = String(password ?? '');

  if (value.length < MIN_LENGTH)
    problems.push(`Password must be at least ${MIN_LENGTH} characters`);
  if (value.length > MAX_LENGTH) problems.push(`Password must be at most ${MAX_LENGTH} characters`);
  if (!/[a-zA-Z]/.test(value)) problems.push('Password must contain a letter');
  if (!/\d/.test(value)) problems.push('Password must contain a number');
  // Blocks the passwords that appear first in every credential-stuffing list.
  if (COMMON_PASSWORDS.has(value.toLowerCase())) problems.push('That password is too common');

  return problems;
}

const COMMON_PASSWORDS = new Set([
  'password',
  'password1',
  'password123',
  '12345678',
  '123456789',
  'qwerty123',
  'letmein1',
  'welcome1',
  'admin123',
  'iloveyou1',
]);

export async function hashPassword(password) {
  return bcrypt.hash(String(password), config.auth.bcryptRounds);
}

/**
 * Constant-time-ish verification.
 *
 * Always runs a comparison, even when the user does not exist, via the caller
 * passing a dummy hash. Any early return based on "no such user" turns login
 * into a user-enumeration oracle.
 */
export async function verifyPassword(password, hash) {
  if (!hash) return false;
  return bcrypt.compare(String(password), hash);
}

/**
 * A hash with no known plaintext, used to burn the same CPU time on a missing
 * account as on a real one.
 *
 * Computed lazily with the *configured* cost factor. A hardcoded round count
 * would be a timing oracle: comparing against a cheap hash returns in ~3ms while
 * a real account costs ~300ms at 12 rounds, which tells an attacker exactly
 * which emails exist.
 */
let dummyHash = null;

export function getDummyPasswordHash() {
  if (!dummyHash) {
    dummyHash = bcrypt.hashSync('not-a-real-password-0', config.auth.bcryptRounds);
  }
  return dummyHash;
}

/** Opaque, high-entropy token for refresh and reset flows. */
export function generateOpaqueToken(bytes = 48) {
  return randomBytes(bytes).toString('base64url');
}

/**
 * Digest used to store refresh/reset tokens.
 *
 * Deliberately SHA-256 rather than bcrypt: these are high-entropy random
 * values, not guessable secrets, so a slow hash buys nothing while making every
 * refresh cost 100ms.
 */
export function hashToken(token) {
  return createHash('sha256').update(`${token}${config.auth.refreshTokenPepper}`).digest('hex');
}

/** Throws a 422 when the password is unacceptable. */
export function assertPasswordAcceptable(password) {
  const problems = validatePassword(password);
  if (problems.length) {
    throw ApiError.unprocessable('Password does not meet the requirements', {
      code: 'WEAK_PASSWORD',
      details: { password: problems },
    });
  }
}
