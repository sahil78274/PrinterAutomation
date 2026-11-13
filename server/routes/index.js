import { Router } from 'express';
import healthRoutes from './healthRoutes.js';
import machineRoutes from './machineRoutes.js';
import shopRoutes from './shopRoutes.js';
import authRoutes from './authRoutes.js';
import orderRoutes from './orderRoutes.js';
import documentRoutes from './documentRoutes.js';
import agentRoutes from './agentRoutes.js';
import analyticsRoutes from './analyticsRoutes.js';
import staffRoutes from './staffRoutes.js';
import subscriptionRoutes from './subscriptionRoutes.js';
import printJobRoutes from './printJobRoutes.js';
import adminRoutes from './adminRoutes.js';
import paymentRoutes from './paymentRoutes.js';
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
router.use('/analytics', analyticsRoutes);
router.use('/staff', staffRoutes);
router.use('/subscriptions', subscriptionRoutes);
router.use('/print-jobs', printJobRoutes);
router.use('/admin', adminRoutes);
router.use('/payments', paymentRoutes);
router.use('/machines', machineRoutes);
router.use('/shops', shopRoutes);

/**
 * Every namespace in the product brief is now mounted above. There are no
 * reserved placeholders left: a 404 here means the URL is genuinely wrong,
 * not that a feature is unbuilt.
 */

export default router;
