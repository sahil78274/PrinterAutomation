/**
 * Uniform response envelopes.
 *
 * Success:  { success: true,  data: <payload>, meta?: { ... } }
 * Failure:  { success: false, error: { code, message, details? }, requestId }
 *
 * Keeping this consistent from the first endpoint means the frontend service
 * layer can handle every response with one code path.
 */

export function sendSuccess(res, data = null, { status = 200, meta } = {}) {
  const body = { success: true, data };
  if (meta !== undefined) body.meta = meta;
  return res.status(status).json(body);
}

export function sendCreated(res, data = null, meta) {
  return sendSuccess(res, data, { status: 201, meta });
}

export function sendNoContent(res) {
  return res.status(204).end();
}

export function sendError(
  res,
  { status = 500, code = 'INTERNAL_ERROR', message = 'Internal server error', details, requestId },
) {
  return res.status(status).json({
    success: false,
    error: { code, message, ...(details ? { details } : {}) },
    ...(requestId ? { requestId } : {}),
  });
}

/**
 * Build pagination metadata for list endpoints.
 */
export function buildPaginationMeta({ page = 1, limit = 20, total = 0 }) {
  const safeLimit = Math.max(1, Number(limit) || 20);
  const safePage = Math.max(1, Number(page) || 1);
  const pages = Math.max(1, Math.ceil(total / safeLimit));
  return {
    page: safePage,
    limit: safeLimit,
    total,
    pages,
    hasNext: safePage < pages,
    hasPrev: safePage > 1,
  };
}
