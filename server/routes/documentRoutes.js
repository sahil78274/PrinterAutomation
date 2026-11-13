import { Router } from 'express';
import {
  uploadDocumentHandler,
  uploadMiddleware,
  downloadDocumentHandler,
} from '../controllers/documentController.js';
import { optionalAuth } from '../middleware/auth.js';
import { publicLimiter } from '../middleware/rateLimiters.js';

const router = Router();

/**
 * Documents.
 *
 * Upload is public because the customer scanning a QR has no account — the
 * machine id in the form body is what binds the upload to a shop. Download
 * requires possession of the document id, and shop staff can additionally read
 * their own shop's documents.
 *
 * There is no static file route for the storage directory, so a document is
 * unreachable except through these handlers.
 */

router.post('/', publicLimiter, optionalAuth, uploadMiddleware, uploadDocumentHandler);
router.get('/:documentId/file', optionalAuth, downloadDocumentHandler);

export default router;
