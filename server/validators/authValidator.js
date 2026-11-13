import { cleanString, isEmail } from './common.js';

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

export function validateRegister(body = {}) {
  const errors = {};
  const value = {};

  value.name = cleanString(body.name, 120);
  if (!value.name) errors.name = 'Your name is required';

  value.email = emailValue(errors, body.email);

  const passwordIssue = passwordErrors(body.password);
  if (passwordIssue) errors.password = passwordIssue;
  else value.password = String(body.password);

  value.shopName = cleanString(body.shopName, 120);
  if (!value.shopName) errors.shopName = 'Shop name is required';

  value.phone = cleanString(body.phone, 20);

  // Role is intentionally not read from the body. Public signup creates an
  // owner; accepting `role` here would be a privilege-escalation hole.
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
