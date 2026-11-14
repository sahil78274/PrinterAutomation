import { cleanString, isEmail, isBlank } from './common.js';
import { validatePassword } from '../services/passwordService.js';

/**
 * Auth request validation.
 *
 * Same contract as every other validator: `{ value, errors }`, where `errors`
 * is a field → message map and an empty object means valid. Validation happens
 * before any business logic so malformed input never reaches the database, and
 * never produces a 500.
 */

function passwordErrors(password) {
  const value = String(password ?? '');
  if (!value) return 'Password is required';
  if (value.length < 8) return 'Password must be at least 8 characters';
  if (value.length > 72) return 'Password must be at most 72 characters';
  if (!/[a-zA-Z]/.test(value)) return 'Password must contain a letter';
  if (!/\d/.test(value)) return 'Password must contain a number';
  return null;
}

function emailValue(errors, raw) {
  const email = cleanString(raw, 160);
  if (!email) {
    errors.email = 'Email is required';
    return null;
  }
  if (!isEmail(email)) {
    errors.email = 'Enter a valid email address';
    return null;
  }
  return email.toLowerCase();
}

/**
 * Indian mobile number validation.
 * Accepts +91XXXXXXXXXX, 91XXXXXXXXXX, or 10-digit starting with 6-9.
 */
function phoneErrors(phone) {
  const value = String(phone ?? '').replace(/[\s\-()]/g, '');
  if (!value) return 'Mobile number is required';
  // Strip +91 or 91 prefix
  const digits = value.replace(/^\+?91/, '');
  if (!/^[6-9]\d{9}$/.test(digits)) {
    return 'Enter a valid 10-digit Indian mobile number';
  }
  return null;
}

/**
 * Indian PIN code validation (6 digits).
 */
function pincodeErrors(pincode) {
  const value = String(pincode ?? '').trim();
  if (!value) return 'PIN code is required';
  if (!/^\d{6}$/.test(value)) {
    return 'PIN code must be a 6-digit number';
  }
  return null;
}

/**
 * Validate shop owner registration.
 *
 * Accepts all required fields for a real production registration:
 * Shop info: shopName, ownerName, email, phone, address, city, state, pincode
 * Account info: password, termsAccepted
 *
 * Role is NEVER read from the body — public signup creates an owner only.
 * Accepting role here would be a privilege-escalation hole.
 */
export function validateRegister(body = {}) {
  const errors = {};
  const value = {};

  // --- Account information ---
  value.name = cleanString(body.name ?? body.ownerName, 120);
  if (!value.name) errors.name = 'Owner name is required';

  value.email = emailValue(errors, body.email);

  const passwordIssue = passwordErrors(body.password);
  if (passwordIssue) errors.password = passwordIssue;
  else value.password = String(body.password);

  // --- Shop information ---
  value.shopName = cleanString(body.shopName, 120);
  if (!value.shopName) errors.shopName = 'Shop name is required';

  value.phone = cleanString(body.phone, 20);
  const phoneIssue = phoneErrors(body.phone);
  if (phoneIssue) errors.phone = phoneIssue;

  // --- Address information ---
  value.address = cleanString(body.address, 200);
  if (!value.address) errors.address = 'Shop address is required';

  value.city = cleanString(body.city, 80);
  if (!value.city) errors.city = 'City is required';

  value.state = cleanString(body.state, 80);
  if (!value.state) errors.state = 'State is required';

  value.pincode = cleanString(body.pincode, 12);
  const pincodeIssue = pincodeErrors(body.pincode);
  if (pincodeIssue) errors.pincode = pincodeIssue;

  // --- Terms acceptance ---
  if (!body.termsAccepted && body.termsAccepted !== true) {
    errors.termsAccepted = 'You must accept the Terms and Conditions';
  }
  value.termsAccepted = body.termsAccepted === true;

  return { value, errors };
}

export function validateLogin(body = {}) {
  const errors = {};
  const value = {};

  value.email = emailValue(errors, body.email);

  // Only presence is checked on login. Applying the strength rules here would
  // reject legacy passwords and tell an attacker about the policy.
  const password = String(body.password ?? '');
  if (!password) errors.password = 'Password is required';
  else value.password = password;

  return { value, errors };
}

export function validateRefresh(body = {}) {
  const errors = {};
  const token = cleanString(body.refreshToken, 512);
  if (!token) errors.refreshToken = 'Refresh token is required';
  return { value: { refreshToken: token }, errors };
}

export function validateLogout(body = {}) {
  const errors = {};
  const token = cleanString(body.refreshToken, 512);
  const allSessions = body.allSessions === true;

  if (!token && !allSessions) {
    errors.refreshToken = 'Provide a refresh token, or set allSessions to true';
  }

  return { value: { refreshToken: token, allSessions }, errors };
}

export function validatePasswordResetRequest(body = {}) {
  const errors = {};
  return { value: { email: emailValue(errors, body.email) }, errors };
}

export function validatePasswordResetConfirm(body = {}) {
  const errors = {};
  const value = {};

  const token = cleanString(body.token, 512);
  if (!token) errors.token = 'Reset token is required';
  else value.token = token;

  const passwordIssue = passwordErrors(body.password);
  if (passwordIssue) errors.password = passwordIssue;
  else value.password = String(body.password);

  return { value, errors };
}

export function validatePasswordChange(body = {}) {
  const errors = {};
  const value = {};

  const currentPassword = String(body.currentPassword ?? '');
  if (!currentPassword) errors.currentPassword = 'Current password is required';
  else value.currentPassword = currentPassword;

  const passwordIssue = passwordErrors(body.newPassword);
  if (passwordIssue) errors.newPassword = passwordIssue;
  else value.newPassword = String(body.newPassword);

  return { value, errors };
}

/**
 * Validate a first-admin bootstrap request.
 *
 * Deliberately strict about the password: this account controls every tenant on
 * the platform, so it gets the full policy rather than a relaxed one.
 */
export function validateBootstrapAdmin(body = {}) {
  const errors = {};
  const value = {};

  const name = cleanString(body.name, 80);
  if (!name || name.length < 2) errors.name = 'Enter a name';
  else value.name = name;

  const email = String(body.email ?? '')
    .trim()
    .toLowerCase();
  if (!email) errors.email = 'Email is required';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Enter a valid email address';
  else value.email = email;

  const password = typeof body.password === 'string' ? body.password : '';
  if (!password) {
    errors.password = 'A password is required';
  } else {
    const problems = validatePassword(password);
    if (problems.length) errors.password = problems[0];
    else value.password = password;
  }

  const setupKey = String(body.setupKey ?? '');
  if (!setupKey) errors.setupKey = 'A setup key is required';
  else value.setupKey = setupKey;

  return { value, errors };
}
