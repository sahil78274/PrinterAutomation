import ApiError from '../utils/ApiError.js';

/**
 * Validation middleware factory.
 *
 * Validators live in ../validators and are plain functions returning
 * { value, errors }. No validation library is used: the rules the API needs
 * (ids, enums, ranges, pagination) are small enough to express directly, which
 * keeps the dependency surface at the seven packages this phase allows.
 *
 *   validate(validateCreateMachine, 'body')
 */
export default function validate(validator, source = 'body') {
  return function validationMiddleware(req, res, next) {
    const { value, errors } = validator(req[source] ?? {});

    if (errors && Object.keys(errors).length) {
      return next(
        ApiError.unprocessable('Request validation failed', {
          code: 'VALIDATION_ERROR',
          details: errors,
        }),
      );
    }

    // Replace the raw input with the sanitised/coerced value.
    //
    // For 'body' and 'query' a direct assignment is correct. 'params' is a
    // getter on Express 5 (Express 4 keeps it on an internal property), so
    // assigning `req.params` is silently discarded and the controller would
    // receive the *raw* path segment — a leniency mismatch waiting to happen.
    // Mutating the existing object works on both versions.
    if (source === 'params' && req.params) {
      Object.assign(req.params, value);
    } else {
      req[source] = value;
    }
    return next();
  };
}
