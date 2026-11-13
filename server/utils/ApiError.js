/**
 * Operational error with an HTTP status and a stable machine-readable code.
 *
 * Anything thrown that is *not* an ApiError is treated as a programmer error
 * by the error middleware: it is logged with a stack trace and, in production,
 * its message is replaced with a generic one so internals never leak.
 */
export default class ApiError extends Error {
  /**
   * @param {number} statusCode HTTP status
   * @param {string} message    Human-readable, safe to show a client
   * @param {object} [options]
   * @param {string} [options.code]      Stable code, e.g. 'MACHINE_NOT_FOUND'
   * @param {object} [options.details]   Field-level validation detail
   * @param {boolean} [options.expose]   Override whether message is client-safe
   * @param {Error}  [options.cause]     Original error, kept for logs only
   */
  constructor(statusCode, message, { code, details, expose, cause } = {}) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code ?? defaultCode(statusCode);
    this.details = details;
    this.isOperational = true;
    // 5xx messages are hidden from clients unless explicitly marked safe.
    this.expose = expose ?? statusCode < 500;
    if (cause) this.cause = cause;
    Error.captureStackTrace?.(this, this.constructor);
  }

  static badRequest(message = 'Bad request', options) {
    return new ApiError(400, message, options);
  }

  static unauthorized(message = 'Authentication required', options) {
    return new ApiError(401, message, options);
  }

  static forbidden(message = 'You do not have access to this resource', options) {
    return new ApiError(403, message, options);
  }

  static notFound(message = 'Resource not found', options) {
    return new ApiError(404, message, options);
  }

  static conflict(message = 'Resource already exists', options) {
    return new ApiError(409, message, options);
  }

  static unprocessable(message = 'Validation failed', options) {
    return new ApiError(422, message, options);
  }

  static tooManyRequests(message = 'Too many requests', options) {
    return new ApiError(429, message, options);
  }

  static internal(message = 'Internal server error', options) {
    return new ApiError(500, message, { expose: false, ...options });
  }

  static serviceUnavailable(message = 'Service temporarily unavailable', options) {
    return new ApiError(503, message, { expose: true, ...options });
  }
}

function defaultCode(statusCode) {
  const map = {
    400: 'BAD_REQUEST',
    401: 'UNAUTHORIZED',
    403: 'FORBIDDEN',
    404: 'NOT_FOUND',
    409: 'CONFLICT',
    422: 'VALIDATION_ERROR',
    429: 'RATE_LIMITED',
    500: 'INTERNAL_ERROR',
    503: 'SERVICE_UNAVAILABLE',
  };
  return map[statusCode] ?? 'ERROR';
}
