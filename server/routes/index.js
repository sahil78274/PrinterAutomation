import { Router } from 'express';
import healthRoutes from './healthRoutes.js';
import machineRoutes from './machineRoutes.js';
import shopRoutes from './shopRoutes.js';
import authRoutes from './authRoutes.js';
import orderRoutes from './orderRoutes.js';
import documentRoutes from './documentRoutes.js';
import agentRoutes from './agentRoutes.js';
import ApiError from '../utils/ApiError.js';
import { sendSuccess } from '../utils/apiResponse.js';

const router = Router();

/**
 * GET /api
 * Discoverable index of the surface, so a developer hitting the API root does
 * not have to read the source to find out what exists.
 */
router.get('/', (req, res) =>
  sendSuccess(res, {
    name: 'SmartPrint API',
    version: '1.0.0',
    endpoints: {
      health: 'GET /api/health',
      readiness: 'GET /api/health/ready',
      auth: {
        register: 'POST /api/auth/register',
        login: 'POST /api/auth/login',
        refresh: 'POST /api/auth/refresh',
        logout: 'POST /api/auth/logout',
        me: 'GET /api/auth/me',
        forgotPassword: 'POST /api/auth/password/forgot',
        resetPassword: 'POST /api/auth/password/reset',
        changePassword: 'POST /api/auth/password/change',
      },
      machineByQr: 'GET /api/machines/:machineId',
      machinesByShop: 'GET /api/machines?shopId=<id>',
      registerMachine: 'POST /api/machines',
      shops: 'GET /api/shops',
      orders: {
        create: 'POST /api/orders',
        tracking: 'GET /api/orders/:orderId',
        pay: 'POST /api/orders/:orderId/pay',
        confirm: 'POST /api/orders/:orderId/confirm',
      },
      documents: {
        upload: 'POST /api/documents (multipart, field "file")',
        download: 'GET /api/documents/:documentId/file',
      },
      agents: {
        register: 'POST /api/agents/register',
        heartbeat: 'POST /api/agents/heartbeat',
        nextJob: 'GET /api/agents/jobs/next',
        download: 'GET /api/agents/jobs/:jobId/document',
        printing: 'POST /api/agents/jobs/:jobId/printing',
        complete: 'POST /api/agents/jobs/:jobId/complete',
        fail: 'POST /api/agents/jobs/:jobId/fail',
      },
    },
  }),
);

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/orders', orderRoutes);
router.use('/documents', documentRoutes);
router.use('/agents', agentRoutes);
router.use('/machines', machineRoutes);
router.use('/shops', shopRoutes);

/**
 * Namespaces reserved for modules not built yet.
 *
 * Declaring them explicitly means: (a) a future module cannot silently collide
 * with an existing path, and (b) a caller gets "this exists but is not ready"
 * rather than a bare 404 that looks like a typo.
 */
const PLANNED = {
  users: 'User and staff management',
  pricing: 'Quote calculation',
  payments: 'Payments and refunds',
  'print-jobs': 'Print job state machine',
  analytics: 'Shop and platform reporting',
  subscriptions: 'Plan management and invoicing',
  admin: 'Platform administration',
  notifications: 'User notifications',
};

for (const [prefix, description] of Object.entries(PLANNED)) {
  router.use(`/${prefix}`, (req, res, next) => {
    next(
      ApiError.notFound(`The /api/${prefix} namespace is reserved — ${description}`, {
        code: 'NOT_IMPLEMENTED',
        expose: true,
      }),
    );
  });
}

export default router;
