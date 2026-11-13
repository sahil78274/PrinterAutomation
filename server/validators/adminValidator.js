/** Validate a platform account status change. */
export function validateUserStatus(body = {}) {
  const errors = {};
  const status = String(body.status ?? '').trim();
  if (!['active', 'suspended'].includes(status)) {
    errors.status = "Status must be 'active' or 'suspended'";
  }
  const reason = body.reason === undefined ? null : String(body.reason).trim().slice(0, 200);
  return { value: { status, reason }, errors };
}
