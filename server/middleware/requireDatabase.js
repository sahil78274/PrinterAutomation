import { getConnectionState } from '../config/database.js';
import ApiError from '../utils/ApiError.js';

/**
 * Guard for routes that need MongoDB.
 *
 * Without this, a request arriving while the database is down would hang until
 * Mongoose's buffer timeout and surface as an opaque 500. Failing fast with a
 * 503 and a clear message is both more honest and easier to operate.
 *
 * Routes are mounted regardless of connection state, so the API's shape does
 * not change depending on infrastructure health — only the readiness check does.
 */
export default function requireDatabase(req, res, next) {
  const { isConnected } = getConnectionState();

  if (!isConnected) {
    return next(
      ApiError.serviceUnavailable('Database is not connected. Please retry shortly.', {
        code: 'DATABASE_UNAVAILABLE',
      }),
    );
  }

  return next();
}
