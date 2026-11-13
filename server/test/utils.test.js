import test, { describe, mock } from 'node:test';
import assert from 'node:assert/strict';
import ApiError from '../utils/ApiError.js';
import { sendError, sendSuccess, buildPaginationMeta } from '../utils/apiResponse.js';
import {
  parsePagination,
  isBlank,
  isEmail,
  isObjectId,
  clampInt,
  cleanString,
} from '../validators/common.js';
import { validateMachineIdParam, validateRegisterMachine } from '../validators/machineValidator.js';
import { validateCreateShop } from '../validators/shopValidator.js';
import asyncHandler from '../utils/asyncHandler.js';
import validate from '../middleware/validate.js';
import logger from '../utils/logger.js';

/** Minimal express-like response double, so response shape is asserted directly. */
function fakeRes() {
  const res = {
    statusCode: 200,
    body: undefined,
    ended: false,
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(payload) {
      res.body = payload;
      return res;
    },
    end() {
      res.ended = true;
      return res;
    },
  };
  return res;
}

describe('ApiError', () => {
  test('derives a stable code from the status', () => {
    assert.equal(ApiError.badRequest().code, 'BAD_REQUEST');
    assert.equal(ApiError.notFound().code, 'NOT_FOUND');
    assert.equal(ApiError.unprocessable().code, 'VALIDATION_ERROR');
    assert.equal(ApiError.serviceUnavailable().code, 'SERVICE_UNAVAILABLE');
  });

  test('an explicit code wins over the default', () => {
    const error = ApiError.notFound('No such machine', { code: 'MACHINE_NOT_FOUND' });
    assert.equal(error.code, 'MACHINE_NOT_FOUND');
    assert.equal(error.statusCode, 404);
  });

  test('4xx messages are exposed, 5xx messages are not', () => {
    assert.equal(ApiError.badRequest('Bad input').expose, true);
    assert.equal(ApiError.internal('stack details here').expose, false);
  });

  test('5xx is never exposed even when a message is supplied', () => {
    const error = ApiError.internal('database password rejected');
    assert.equal(error.expose, false);
    // Service-unavailable is the deliberate exception: clients need to retry.
    assert.equal(ApiError.serviceUnavailable().expose, true);
  });

  test('marks itself operational so the handler can tell it from a bug', () => {
    assert.equal(ApiError.conflict().isOperational, true);
    assert.ok(ApiError.badRequest() instanceof Error);
  });

  test('carries field-level details for validation failures', () => {
    const error = ApiError.unprocessable('Invalid input', { details: { machineId: 'required' } });
    assert.deepEqual(error.details, { machineId: 'required' });
  });
});

describe('response envelope', () => {
  test('success payload is { success, data }', () => {
    const res = fakeRes();
    sendSuccess(res, { id: 'SP-001' });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { success: true, data: { id: 'SP-001' } });
  });

  test('meta is only included when provided', () => {
    const res = fakeRes();
    sendSuccess(res, []);
    assert.equal('meta' in res.body, false);

    const withMeta = fakeRes();
    sendSuccess(withMeta, [], { meta: { page: 2 } });
    assert.deepEqual(withMeta.body.meta, { page: 2 });
  });

  test('created responses use 201', () => {
    const res = fakeRes();
    sendSuccess(res, { id: 1 }, { status: 201 });
    assert.equal(res.statusCode, 201);
  });

  test('error payload carries code, message and requestId', () => {
    const res = fakeRes();
    sendError(res, {
      status: 422,
      code: 'VALIDATION_ERROR',
      message: 'Invalid input',
      details: { mobile: 'required' },
      requestId: 'req-1',
    });
    assert.equal(res.statusCode, 422);
    assert.deepEqual(res.body, {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input',
        details: { mobile: 'required' },
      },
      requestId: 'req-1',
    });
  });

  test('error payload omits details and requestId when absent', () => {
    const res = fakeRes();
    sendError(res, { status: 500, code: 'INTERNAL_ERROR', message: 'boom' });
    assert.equal('details' in res.body.error, false);
    assert.equal('requestId' in res.body, false);
  });

  test('success and error envelopes are mutually exclusive', () => {
    const ok = fakeRes();
    sendSuccess(ok, null);
    assert.equal('error' in ok.body, false);

    const bad = fakeRes();
    sendError(bad, {});
    assert.equal('data' in bad.body, false);
  });
});

describe('pagination meta', () => {
  test('computes pages and boundary flags', () => {
    const meta = buildPaginationMeta({ page: 2, limit: 10, total: 35 });
    assert.equal(meta.pages, 4);
    assert.equal(meta.hasNext, true);
    assert.equal(meta.hasPrev, true);
  });

  test('first page has no previous page; last page has no next', () => {
    assert.equal(buildPaginationMeta({ page: 1, limit: 10, total: 20 }).hasPrev, false);
    assert.equal(buildPaginationMeta({ page: 2, limit: 10, total: 20 }).hasNext, false);
  });

  test('guards against nonsense input', () => {
    const meta = buildPaginationMeta({ page: -5, limit: 0, total: 0 });
    assert.equal(meta.page, 1);
    assert.equal(meta.limit, 20);
    assert.equal(meta.pages, 1);
  });
});

describe('parsePagination', () => {
  test('defaults to page 1, limit 20', () => {
    assert.deepEqual(parsePagination({}), { page: 1, limit: 20 });
  });

  test('parses string query values into numbers', () => {
    assert.deepEqual(parsePagination({ page: '3', limit: '25' }), { page: 3, limit: 25 });
  });

  test('clamps limit into 1..100', () => {
    assert.equal(parsePagination({ limit: '1000' }).limit, 100);
    assert.equal(parsePagination({ limit: '0' }).limit, 1);
    assert.equal(parsePagination({ limit: '-3' }).limit, 1);
  });

  test('never yields a page below 1', () => {
    assert.equal(parsePagination({ page: '-2' }).page, 1);
  });

  test('ignores non-numeric input rather than producing NaN', () => {
    const result = parsePagination({ page: 'abc', limit: 'xyz' });
    assert.equal(Number.isNaN(result.page), false);
    assert.equal(Number.isNaN(result.limit), false);
  });
});

describe('string helpers', () => {
  test('isBlank treats whitespace as empty', () => {
    assert.equal(isBlank('   '), true);
    assert.equal(isBlank(''), true);
    assert.equal(isBlank(null), true);
    assert.equal(isBlank(undefined), true);
    assert.equal(isBlank('x'), false);
    assert.equal(isBlank(0), false);
  });

  test('isEmail rejects the shapes that matter', () => {
    assert.equal(isEmail('owner@smartprint.in'), true);
    assert.equal(isEmail('a@b.co'), true);
    assert.equal(isEmail('no-at-sign'), false);
    assert.equal(isEmail('two@@at.com'), false);
    assert.equal(isEmail('spaces in@mail.com'), false);
    assert.equal(isEmail('trailing@dot.'), false);
    assert.equal(isEmail(null), false);
  });

  test('isObjectId requires 24 hex characters', () => {
    assert.equal(isObjectId('507f1f77bcf86cd799439011'), true);
    assert.equal(isObjectId('507F1F77BCF86CD799439011'), true);
    assert.equal(isObjectId('507f1f77bcf86cd79943901'), false);
    assert.equal(isObjectId('zzzzzzzzzzzzzzzzzzzzzzzz'), false);
  });

  test('clampInt falls back instead of returning NaN', () => {
    assert.equal(clampInt('7', { min: 1, max: 10, fallback: 5 }), 7);
    assert.equal(clampInt('99', { min: 1, max: 10, fallback: 5 }), 10);
    assert.equal(clampInt('abc', { min: 1, max: 10, fallback: 5 }), 5);
  });

  test('cleanString trims, caps and nulls blanks', () => {
    assert.equal(cleanString('  hi  '), 'hi');
    assert.equal(cleanString('   '), null);
    assert.equal(cleanString('abcdef', 3), 'abc');
  });
});

describe('asyncHandler', () => {
  test('forwards a rejected promise to next() instead of crashing', async () => {
    const boom = new Error('boom');
    const next = mock.fn();
    const handler = asyncHandler(async () => {
      throw boom;
    });

    await handler({}, fakeRes(), next);
    assert.equal(next.mock.callCount(), 1);
    assert.equal(next.mock.calls[0].arguments[0], boom);
  });

  test('does not call next() when the handler succeeds', async () => {
    const next = mock.fn();
    const res = fakeRes();
    const handler = asyncHandler(async (_req, response) => {
      response.status(204).end();
    });

    await handler({}, res, next);
    assert.equal(next.mock.callCount(), 0);
    assert.equal(res.ended, true);
  });
});

describe('machine validator — params', () => {
  const run = (params) => validateMachineIdParam(params);

  test('accepts a canonical ID', () => {
    assert.deepEqual(run({ machineId: 'SP-001' }), { value: { machineId: 'SP-001' }, errors: {} });
  });

  test('canonicalises lower case and missing padding', () => {
    assert.equal(run({ machineId: 'sp-7' }).value.machineId, 'SP-007');
    assert.equal(run({ machineId: ' sp-0007 ' }).value.machineId, 'SP-007');
  });

  test('rejects a missing ID', () => {
    assert.match(run({}).errors.machineId, /required/);
  });

  test('rejects wrong prefixes, letters and over-long numbers', () => {
    for (const bad of ['XX-001', 'SP-abc', 'SP-1234567', 'SP 001', '001']) {
      assert.ok(run({ machineId: bad }).errors.machineId, `${bad} should be rejected`);
    }
  });

  test('rejects SP-000 — a zero has never been issued', () => {
    assert.ok(run({ machineId: 'SP-000' }).errors.machineId);
  });
});

describe('machine validator — registration body', () => {
  const body = {
    shopId: '507f1f77bcf86cd799439011',
    name: 'Counter A',
    printer: { model: 'HP M404dn', supportsColor: false, supportsDuplex: true },
  };

  test('accepts a minimal valid payload', () => {
    const { errors, value } = validateRegisterMachine(body);
    assert.deepEqual(errors, {});
    assert.equal(value.shopId, body.shopId);
    assert.equal(value.name, 'Counter A');
  });

  test('requires a shopId', () => {
    const { errors } = validateRegisterMachine({ ...body, shopId: undefined });
    assert.match(errors.shopId, /required/);
  });

  test('rejects a malformed shopId before any database call', () => {
    const { errors } = validateRegisterMachine({ ...body, shopId: 'not-an-id' });
    assert.match(errors.shopId, /valid/i);
  });

  test('rejects negative prices', () => {
    const { errors } = validateRegisterMachine({
      ...body,
      pricing: { bwSinglePaise: -1 },
    });
    assert.ok(errors['pricing.bwSinglePaise'] || errors.pricing);
  });

  test('rejects non-integer paise — money is never fractional', () => {
    const { errors } = validateRegisterMachine({
      ...body,
      pricing: { bwSinglePaise: 2.5 },
    });
    assert.ok(Object.keys(errors).length > 0);
  });
});

describe('shop validator', () => {
  const valid = {
    name: 'Sharma Digital Press',
    ownerName: 'Rakesh Sharma',
    email: 'owner@example.com',
    phone: '9812345678',
  };

  test('accepts a valid payload', () => {
    assert.deepEqual(validateCreateShop(valid).errors, {});
  });

  test('requires a name, owner, email and phone', () => {
    const { errors } = validateCreateShop({});
    for (const field of ['name', 'ownerName', 'email', 'phone']) {
      assert.ok(errors[field], `${field} should be required`);
    }
  });

  test('rejects an invalid email', () => {
    assert.ok(validateCreateShop({ ...valid, email: 'nope' }).errors.email);
  });

  test('lowercases the email so lookups are case-insensitive', () => {
    assert.equal(
      validateCreateShop({ ...valid, email: 'OWNER@Example.COM' }).value.email,
      'owner@example.com',
    );
  });

  test('rejects a phone number that is too short', () => {
    assert.ok(validateCreateShop({ ...valid, phone: '123' }).errors.phone);
  });
});

describe('validate middleware', () => {
  test('canonicalises params in place so the controller sees the sanitised ID', async () => {
    // Express exposes params as a getter, so a naive `req.params = value`
    // assignment is dropped and the controller would run on raw input.
    const params = Object.create(null);
    params.machineId = 'sp-7';
    Object.defineProperty(params, 'machineId', {
      value: 'sp-7',
      writable: true,
      enumerable: true,
      configurable: true,
    });

    const req = { params };
    const next = mock.fn();
    validate(validateMachineIdParam, 'params')(req, fakeRes(), next);

    assert.equal(next.mock.callCount(), 1);
    assert.equal(next.mock.calls[0].arguments[0], undefined);
    assert.equal(req.params.machineId, 'SP-007');
  });

  test('rejects an invalid param with a 422-style ApiError', () => {
    const req = { params: { machineId: 'NOPE' } };
    const next = mock.fn();
    validate(validateMachineIdParam, 'params')(req, fakeRes(), next);

    const error = next.mock.calls[0].arguments[0];
    assert.equal(error.statusCode, 422);
    assert.equal(error.code, 'VALIDATION_ERROR');
    assert.ok(error.details.machineId);
  });

  test('replaces a body with its sanitised value', () => {
    const req = { body: { shopId: 'x'.repeat(24), name: '  Counter  ' } };
    const next = mock.fn();
    validate((body) => ({ value: { name: body.name.trim() }, errors: {} }), 'body')(
      req,
      fakeRes(),
      next,
    );
    assert.deepEqual(req.body, { name: 'Counter' });
  });

  test('passes through when the validator reports no errors', () => {
    const req = { body: {} };
    const next = mock.fn();
    validate(() => ({ value: { ok: true }, errors: {} }), 'body')(req, fakeRes(), next);
    assert.equal(next.mock.callCount(), 1);
    // next() is called with no error argument at all, not with undefined.
    assert.equal(next.mock.calls[0].arguments.length, 0);
  });
});

describe('logger', () => {
  test('exposes the level helpers the server uses', () => {
    for (const level of ['info', 'warn', 'error', 'debug']) {
      assert.equal(typeof logger[level], 'function', `${level} missing`);
    }
  });

  test('does not throw on unusual arguments', () => {
    assert.doesNotThrow(() => logger.info('plain'));
    assert.doesNotThrow(() => logger.warn('with meta', { requestId: 'r1' }));
    assert.doesNotThrow(() => logger.error(new Error('nope')));
  });
});
