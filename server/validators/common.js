/**
 * Small, dependency-free validation helpers.
 *
 * Each validator returns { value, errors } where `errors` is a field → message
 * map (empty when valid). `validate` middleware turns this into a 422.
 */

export const isBlank = (value) =>
  value === undefined || value === null || String(value).trim() === '';

export function isEmail(value) {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function isObjectId(value) {
  return typeof value === 'string' && /^[a-f\d]{24}$/i.test(value);
}

export function clampInt(value, { min, max, fallback }) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

/** Trim and cap a string; returns null for blanks. */
export function cleanString(value, maxLength = 255) {
  if (isBlank(value)) return null;
  return String(value).trim().slice(0, maxLength);
}

export function requireString(errors, field, value, { max = 255, min = 1 } = {}) {
  const cleaned = cleanString(value, max);
  if (!cleaned) {
    errors[field] = `${humanise(field)} is required`;
    return null;
  }
  if (cleaned.length < min) {
    errors[field] = `${humanise(field)} must be at least ${min} characters`;
    return null;
  }
  return cleaned;
}

export function requireEmail(errors, field, value) {
  const cleaned = cleanString(value, 160);
  if (!cleaned) {
    errors[field] = `${humanise(field)} is required`;
    return null;
  }
  if (!isEmail(cleaned)) {
    errors[field] = 'Enter a valid email address';
    return null;
  }
  return cleaned.toLowerCase();
}

export function optionalEnum(errors, field, value, allowed) {
  if (isBlank(value)) return undefined;
  const normalised = String(value).trim();
  if (!allowed.includes(normalised)) {
    errors[field] = `${humanise(field)} must be one of: ${allowed.join(', ')}`;
    return undefined;
  }
  return normalised;
}

/**
 * Parse pagination query params into safe integers.
 */
export function parsePagination(query = {}) {
  return {
    page: clampInt(query.page, { min: 1, max: 10_000, fallback: 1 }),
    limit: clampInt(query.limit, { min: 1, max: 100, fallback: 20 }),
  };
}

export function humanise(field) {
  return String(field)
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (char) => char.toUpperCase())
    .trim();
}
