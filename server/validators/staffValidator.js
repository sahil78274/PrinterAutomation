import { cleanString } from './common.js';
import { validatePassword } from '../services/passwordService.js';
import { ALL_PERMISSIONS } from '../services/staffService.js';

/** Validate a staff invitation. The role is never accepted from the body. */
export function validateCreateStaff(body = {}) {
  const errors = {};
  const value = {};

  const name = cleanString(body.name, 80);
  if (!name || name.length < 2) errors.name = 'Enter the staff member name';
  else value.name = name;

  const email = String(body.email ?? '')
    .trim()
    .toLowerCase();
  if (!email) errors.email = 'Email is required';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Enter a valid email address';
  else value.email = email;

  const password = typeof body.password === 'string' ? body.password : '';
  if (!password) {
    errors.password = 'A temporary password is required';
  } else {
    // validatePassword returns a list of problems (empty when acceptable).
    const problems = validatePassword(password);
    if (problems.length) errors.password = problems[0];
    else value.password = password;
  }

  if (body.permissions !== undefined) {
    if (!Array.isArray(body.permissions)) {
      errors.permissions = 'Permissions must be a list';
    } else {
      const invalid = body.permissions.filter(
        (permission) => !ALL_PERMISSIONS.includes(permission),
      );
      if (invalid.length) errors.permissions = `Unknown permission: ${invalid.join(', ')}`;
      else value.permissions = body.permissions;
    }
  }

  // `role` is purposely not read: a staff invite always creates a staff account.

  return { value, errors };
}

export function validateUpdateStaff(body = {}) {
  const errors = {};
  const value = {};

  if (body.name !== undefined) {
    const name = cleanString(body.name, 80);
    if (!name || name.length < 2) errors.name = 'Enter a valid name';
    else value.name = name;
  }

  if (body.permissions !== undefined) {
    if (!Array.isArray(body.permissions)) {
      errors.permissions = 'Permissions must be a list';
    } else {
      const invalid = body.permissions.filter(
        (permission) => !ALL_PERMISSIONS.includes(permission),
      );
      if (invalid.length) errors.permissions = `Unknown permission: ${invalid.join(', ')}`;
      else value.permissions = body.permissions;
    }
  }

  if (body.status !== undefined) {
    if (!['active', 'suspended'].includes(body.status)) {
      errors.status = "Status must be 'active' or 'suspended'";
    } else {
      value.status = body.status;
    }
  }

  if (!Object.keys(value).length && !Object.keys(errors).length) {
    errors.body = 'Nothing to update';
  }

  return { value, errors };
}
