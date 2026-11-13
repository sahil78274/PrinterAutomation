import multer from 'multer';
import config from '../config/index.js';
import asyncHandler from '../utils/asyncHandler.js';
import { sendCreated } from '../utils/apiResponse.js';
import ApiError from '../utils/ApiError.js';
import { getRepository } from '../repositories/active.js';
import { storeDocument, publicDocument, readDocument } from '../services/documentService.js';
import { audit } from '../services/auditService.js';

/**
 * Document upload and authenticated download.
 *
 * The upload is deliberately paranoid:
 *  - memory storage, so nothing is written to disk before it is validated;
 *  - a hard byte limit enforced by multer as the stream arrives, not after;
 *  - exactly one file per request, field name `file`;
 *  - the bytes are then checked for a real PDF signature and parsed for a page
 *    count before anything is persisted.
 */

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.uploads.maxBytes,
    files: 1,
    // A PDF upload needs no exotic fields; bounding them limits abuse.
    fields: 10,
    parts: 12,
  },
  fileFilter(req, file, cb) {
    // Advisory only — the signature check in documentService is authoritative.
    if (file.mimetype !== 'application/pdf') {
      return cb(
        ApiError.unprocessable('Only PDF files are accepted', {
          code: 'UNSUPPORTED_FILE_TYPE',
          details: { file: `Received ${file.mimetype}` },
        }),
      );
    }
    return cb(null, true);
  },
}).single('file');

/**
 * Wrap multer so its own errors (too large, wrong field) come out in the same
 * JSON envelope as everything else instead of a bare HTML 500.
 */
export function uploadMiddleware(req, res, next) {
  upload(req, res, (error) => {
    if (!error) return next();

    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return next(
          ApiError.payloadTooLarge(
            `That file is larger than the ${Math.round(config.uploads.maxBytes / (1024 * 1024))}MB limit`,
            { code: 'FILE_TOO_LARGE', details: { maxBytes: config.uploads.maxBytes } },
          ),
        );
      }
      return next(
        ApiError.badRequest(`Upload rejected: ${error.message}`, { code: 'UPLOAD_REJECTED' }),
      );
    }
    return next(error);
  });
}

/**
 * POST /api/documents
 * multipart/form-data: file=<pdf>, machineId=<SP-001>
 *
 * The machine is required, because an upload must belong to a shop before it can
 * be ordered. Resolving the machine also proves the shop exists and is accepting
 * work.
 */
export const uploadDocumentHandler = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw ApiError.badRequest('No file was uploaded', { code: 'FILE_REQUIRED' });
  }

  const machineId = String(req.body?.machineId ?? '').toUpperCase();
  if (!machineId) {
    throw ApiError.badRequest('machineId is required', { code: 'MACHINE_REQUIRED' });
  }

  const repo = getRepository();
  const machine = await repo.findOne('machines', { machineId });
  if (!machine) {
    throw ApiError.notFound('Machine not found', { code: 'MACHINE_NOT_FOUND' });
  }
  if (machine.status === 'maintenance') {
    throw ApiError.conflict('This machine is under maintenance', {
      code: 'MACHINE_UNAVAILABLE',
      details: { machineStatus: machine.status },
    });
  }

  const document = await storeDocument({
    buffer: req.file.buffer,
    originalName: req.file.originalname,
    shopId: machine.shopId,
    machineId: machine.machineId,
    uploadedBy: req.auth?.userId ?? null,
  });

  await audit(req, {
    action: 'document.uploaded',
    entity: 'document',
    entityId: document.id,
    shopId: machine.shopId,
    metadata: {
      pageCount: document.pageCount,
      sizeBytes: document.sizeBytes,
      // The filename is intentionally NOT logged: it is customer content.
    },
  });

  return sendCreated(res, publicDocument(document));
});

/**
 * GET /api/documents/:documentId/file
 *
 * Authenticated delivery. The customer that just uploaded has no account, so
 * access is granted by possession of the document id *and* by the owning shop's
 * staff. Documents are never served statically.
 */
export const downloadDocumentHandler = asyncHandler(async (req, res) => {
  const repo = getRepository();
  const document = await repo.findById('documents', req.params.documentId);
  if (!document) throw ApiError.notFound('Document not found', { code: 'DOCUMENT_NOT_FOUND' });

  // Shop staff may always read their own shop's documents. Anyone else must
  // present the document id, which is an unguessable UUID.
  if (
    req.auth &&
    req.auth.role !== 'admin' &&
    String(document.shopId) !== String(req.auth.shopId)
  ) {
    throw ApiError.notFound('Document not found', { code: 'DOCUMENT_NOT_FOUND' });
  }

  const buffer = await readDocument(document);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Length', String(buffer.length));
  res.setHeader('Content-Disposition', `inline; filename="${document.originalName}"`);
  // Documents are customer content: never cache them anywhere.
  res.setHeader('Cache-Control', 'no-store');
  return res.send(buffer);
});
