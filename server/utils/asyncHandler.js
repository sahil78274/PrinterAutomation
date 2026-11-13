/**
 * Wrap an async route handler so a rejected promise reaches Express's error
 * middleware instead of becoming an unhandled rejection (which Express 4 does
 * not catch on its own).
 *
 *   router.get('/', asyncHandler(async (req, res) => { ... }))
 */
export default function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
