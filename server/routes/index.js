import { Router } from 'express';
import healthRoutes from './healthRoutes.js';
import machineRoutes from './machineRoutes.js';
import shopRoutes from './shopRoutes.js';
import ApiError from '../utils/ApiError.js';
import { sendSuccess } from '../utils/apiResponse.js';

const router = Router();

/**
 * GET /api
 * Tiny index so a developer hitting the API root discovers the surface.
 */
router.get('/', (req, res) =>
  sendSuccess(res, {
    name: 'SmartPrint API',
    version: '1.0.0',
    documentation: '/api/health',
    endpoints: {
      health: '/api/health',
      readiness: '/api/health/ready',
      machineByQr: 'GET /api/machines/:machineId',
      machinesByShop: 'GET /api/machines?shopId=<id>',
      registerMachine: 'POST /api/machines',
      shops: 'GET /api/shops',
    },
  }),
);

router.use('/health', healthRoutes);
router.use('/machines', machineRoutes);
router.use('/shops', shopRoutes);

/**
 * Reserved namespaces. Declaring them now means a future feature can be mounted
 * without any chance of colliding with an existing route, and a caller gets a
 * clear 501 instead of a confusing 404.
 */
const PLANNED = {
  auth: 'Phase 3 — JWT authentication and role-based access control',
  orders: 'Phase 3 — print order creation and lifecycle',
  pricing: 'Phase 3 — quote calculation',
  agents: 'Phase 4 — local Print Agent heartbeat and job claim',
  analytics: 'Phase 5 — shop and platform reporting',
  subscriptions: 'Phase 5 — plan management and invoicing',
};

router.use(
  ['/auth', '/orders', '/pricing', '/agents', '/analytics', '/subscriptions'],
  (req, res, next) => {
    const segment = req.originalUrl.split('/')[2]?.split('?')[0];
    next(
      ApiError.notFound(
        `${segment ? `The /api/${segment} namespace is reserved` : 'Endpoint reserved'} — ${PLANNED[segment] ?? 'not implemented yet'}`,
        { code: 'NOT_IMPLEMENTED', expose: true },
      ),
    );
  },
);

export default router;
