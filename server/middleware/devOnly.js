import config from '../config/index.js';
import ApiError from '../utils/ApiError.js';

/**
 * Temporary guard for admin-only endpoints that exist before authentication.
 *
 * Rather than leaving "POST /api/machines" open to the world until Phase 3,
 * these routes refuse requests unless BOTH:
 *   - the environment is not production, AND
 *   - ALLOW_ANONYMOUS_ADMIN=true is explicitly set
 *
 * In production the guard returns 404 (not 403) so the existence of the endpoint
 * is not advertised to anonymous callers. Phase 3 replaces this with
 * `requireAuth` + `requireRole('admin')`.
 */
export default function devOnlyAdmin(req, res, next) {
  const allowed =
    !config.isProduction &&
    ['1', 'true', 'yes', 'on'].includes(String(process.env.ALLOW_ANONYMOUS_ADMIN).toLowerCase());

  if (!allowed) {
    return next(
      ApiError.notFound('Not found', {
        code: 'NOT_FOUND',
      }),
    );
  }

  return next();
}
