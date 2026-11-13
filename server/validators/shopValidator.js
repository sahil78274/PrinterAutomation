import { cleanString, optionalEnum, requireEmail, requireString } from './common.js';

const PLANS = ['starter', 'growth', 'scale'];
const STATUSES = ['active', 'suspended', 'closed'];

export function validateCreateShop(body = {}) {
  const errors = {};
  const value = {};

  value.name = requireString(errors, 'name', body.name, { max: 120 });
  value.ownerName = requireString(errors, 'ownerName', body.ownerName, { max: 120 });
  value.email = requireEmail(errors, 'email', body.email);
  value.phone = requireString(errors, 'phone', body.phone, { max: 20, min: 6 });

  const address = body.address ?? {};
  value.address = {
    line1: cleanString(address.line1, 200),
    line2: cleanString(address.line2, 200),
    city: cleanString(address.city, 80),
    state: cleanString(address.state, 80),
    pincode: cleanString(address.pincode, 12),
    country: cleanString(address.country, 80) ?? 'India',
  };

  const gstin = cleanString(body.gstin, 20);
  if (gstin && !/^[0-9A-Z]{15}$/i.test(gstin)) {
    errors.gstin = 'GSTIN must be 15 alphanumeric characters';
  } else {
    value.gstin = gstin ? gstin.toUpperCase() : undefined;
  }

  value.planId = optionalEnum(errors, 'planId', body.planId, PLANS);
  value.status = optionalEnum(errors, 'status', body.status, STATUSES);

  return { value: stripUndefined(value), errors };
}

function stripUndefined(object) {
  return Object.fromEntries(Object.entries(object).filter(([, v]) => v !== undefined));
}

export { PLANS, STATUSES };
