import ApiError from '../utils/ApiError.js';
import logger from '../utils/logger.js';
import { sendError } from '../utils/apiResponse.js';

/**
 * 404 handler for unmatched routes.
 *
 * Mounted after all routers, before the error middleware, so unknown API paths
 * return the same JSON envelope as every other failure.
 */
export function notFoundHandler(req, res, next) {
  next(
    ApiError.notFound(`Route ${req.method} ${req.originalUrl} does not exist`, {
      code: 'ROUTE_NOT_FOUND',
    }),
  );
}

/**
 * Normalise the many error shapes that can reach here (Mongoose, JWT, JSON
 * parse failures, programmer errors) into one JSON envelope.
 */
function normaliseError(error) {
  // Our own operational errors pass through untouched.
  if (error instanceof ApiError) return error;

  // Malformed JSON body from express.json()
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return new ApiError(400, 'Request body contains invalid JSON', {
      code: 'INVALID_JSON',
    });
  }

  if (error?.name === 'ValidationError' && error.errors) {
    const details = Object.fromEntries(
      Object.entries(error.errors).map(([field, issue]) => [field, issue.message]),
    );
    return new ApiError(422, 'Validation failed', {
      code: 'VALIDATION_ERROR',
      details,
      cause: error,
    });
  }

  if (error?.name === 'CastError') {
    return new ApiError(400, `Invalid value for "${error.path}"`, {
      code: 'INVALID_IDENTIFIER',
      cause: error,
    });
  }

  // Unique index violation
  if (error?.code === 11000) {
    const fields = Object.keys(error.keyValue ?? {});
    return new ApiError(409, `Duplicate value for ${fields.join(', ') || 'unique field'}`, {
      code: 'DUPLICATE_KEY',
      details: error.keyValue,
      cause: error,
    });
  }

  // Mongoose/Mongo connectivity problems should read as 503, not 500.
  if (
    error?.name === 'MongooseServerSelectionError' ||
    error?.name === 'MongoNetworkError' ||
    /buffering timed out|failed to connect/i.test(error?.message ?? '')
  ) {
    return new ApiError(503, 'Database is unavailable. Please retry shortly.', {
      code: 'DATABASE_UNAVAILABLE',
      cause: error,
    });
  }

  // Anything else is a programmer error: keep it opaque to the client.
  return new ApiError(500, 'Internal server error', { code: 'INTERNAL_ERROR', cause: error });
}

/**
 * Centralised error handler. Must be registered last, and must keep all four
 * arguments so Express recognises it as error middleware.
 */
// eslint-disable-next-line no-unused-vars
export default function errorHandler(error, req, res, next) {
  const normalised = normaliseError(error);
  const status = normalised.statusCode ?? 500;
  const isServerError = status >= 500;

  const logMeta = {
    requestId: req.id,
    method: req.method,
    url: req.originalUrl,
    status,
    code: normalised.code,
  };

  if (isServerError) {
    // Log the original error (with stack) for genuine failures.
    logger.error(normalised.message, { ...logMeta, stack: (normalised.cause ?? error)?.stack });
  } else {
    logger.warn(normalised.message, logMeta);
  }

  // If the response has already begun streaming, delegate to Express.
  if (res.headersSent) return next(error);

  return sendError(res, {
    status,
    code: normalised.code,
    message: normalised.expose ? normalised.message : 'Something went wrong on our side',
    details: normalised.details,
    requestId: req.id,
  });
}
