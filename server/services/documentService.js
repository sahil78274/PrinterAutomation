import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { PDFDocument } from 'pdf-lib';
import config from '../config/index.js';
import ApiError from '../utils/ApiError.js';
import { getRepository } from '../repositories/active.js';

/**
 * Document upload, validation and page counting.
 *
 * ## What is trusted
 *
 * Nothing the browser says. The MIME type, the extension and any client-supplied
 * page count are all ignored. Instead:
 *
 *   1. The file signature must be a real PDF (`%PDF-`), checked against the
 *      bytes — a `.exe` renamed to `.pdf` is rejected here.
 *   2. The page count comes from parsing the actual document with pdf-lib.
 *   3. The size is enforced against the configured limit as bytes are written.
 *
 * ## Storage
 *
 * Files go to a private directory outside the web root (`server/storage`), are
 * addressed by an unguessable key, and are only reachable through an authorised
 * endpoint. There is no static file route for this directory, so a leaked path
 * is not a leaked document.
 *
 * ## Retention
 *
 * Customer documents are the most sensitive data the platform holds. They are
 * deleted after `DOCUMENT_RETENTION_HOURS` (24h by default) or immediately once
 * a job completes, whichever comes first. The order record keeps the *metadata*
 * needed for accounting, never the file.
 */

const PDF_MAGIC = Buffer.from('%PDF-');

/** Reject anything that is not genuinely a PDF by looking at the bytes. */
export function looksLikePdf(buffer) {
  return Buffer.isBuffer(buffer) && buffer.length >= 5 && buffer.subarray(0, 5).equals(PDF_MAGIC);
}

/**
 * Safe, collision-free storage key.
 *
 * The original filename is never used as a path component — that is how
 * directory traversal and Windows reserved-name bugs happen.
 */
export function buildStorageKey(shopId, extension = 'pdf') {
  return `${shopId}/${randomUUID()}.${extension}`;
}

/** Strip anything path-like from a filename, for display only. */
export function sanitiseFilename(name) {
  const base = String(name ?? 'document.pdf')
    .replace(/[/\\]/g, '_')
    .replace(/[^\w.\- ]/g, '_')
    .slice(0, 120)
    .trim();
  return base || 'document.pdf';
}

/**
 * Count pages by parsing the document.
 *
 * A PDF that pdf-lib cannot load is either corrupt or not really a PDF; both
 * are the customer's problem to re-export, and both must fail before payment.
 */
export async function countPdfPages(buffer) {
  try {
    const pdf = await PDFDocument.load(buffer, {
      // Do not trust the file's own claimed page count or metadata.
      updateMetadata: false,
      throwOnInvalidObject: true,
    });
    const pages = pdf.getPageCount();
    if (!Number.isInteger(pages) || pages < 1) {
      throw new Error('No pages found');
    }
    return pages;
  } catch (error) {
    throw ApiError.unprocessable(
      'That file could not be read as a PDF. Please re-export it and try again.',
      { code: 'INVALID_PDF', details: { file: error.message } },
    );
  }
}

/**
 * Persist and validate an uploaded document.
 *
 * @param {object} params
 * @param {Buffer} params.buffer       File contents (already size-limited by multer)
 * @param {string} params.originalName Client-supplied name, sanitised for display
 * @param {string} params.shopId       Tenant owner
 * @param {string} [params.machineId]  Machine the customer scanned
 * @param {string} [params.uploadedBy] User id when not anonymous
 */
export async function storeDocument({
  buffer,
  originalName,
  shopId,
  machineId = null,
  uploadedBy = null,
}) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw ApiError.badRequest('The file is empty', { code: 'EMPTY_FILE' });
  }
  if (buffer.length > config.uploads.maxBytes) {
    throw ApiError.payloadTooLarge(`File exceeds the ${config.uploads.maxBytes} byte limit`, {
      code: 'FILE_TOO_LARGE',
      details: { maxBytes: config.uploads.maxBytes, actualBytes: buffer.length },
    });
  }
  if (!looksLikePdf(buffer)) {
    throw ApiError.unprocessable('Only PDF files are accepted', {
      code: 'UNSUPPORTED_FILE_TYPE',
      details: { file: 'The file contents are not a PDF' },
    });
  }

  const pageCount = await countPdfPages(buffer);
  const storageKey = buildStorageKey(shopId);
  const absolutePath = path.join(config.uploads.dir, storageKey);

  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  // 0o600: readable only by the process that owns it.
  await fs.writeFile(absolutePath, buffer, { mode: 0o600 });

  const expiresAt = new Date(
    Date.now() + config.uploads.retentionHours * 60 * 60 * 1000,
  ).toISOString();

  const document = await getRepository().insert('documents', {
    shopId,
    machineId,
    uploadedBy,
    storageKey,
    originalName: sanitiseFilename(originalName),
    mimeType: 'application/pdf',
    sizeBytes: buffer.length,
    pageCount,
    // Content hash makes duplicate-suppression possible later without keeping
    // a second copy of the file.
    sha256: createHash('sha256').update(buffer).digest('hex'),
    expiresAt,
    deletedAt: null,
  });

  return document;
}

/** Read a document's bytes. Caller must have already authorised access. */
export async function readDocument(document) {
  const absolutePath = path.join(config.uploads.dir, document.storageKey);
  try {
    return await fs.readFile(absolutePath);
  } catch {
    throw ApiError.notFound('The document is no longer available', {
      code: 'DOCUMENT_EXPIRED',
    });
  }
}

/** Remove a single document from disk and mark it deleted. */
export async function deleteDocument(documentId, { reason = 'retention' } = {}) {
  const repo = getRepository();
  const document = await repo.findById('documents', documentId);
  if (!document) return { deleted: false };

  try {
    await fs.unlink(path.join(config.uploads.dir, document.storageKey));
  } catch {
    // Already gone from disk; still mark it deleted in the database.
  }

  await repo.updateById('documents', documentId, {
    deletedAt: new Date().toISOString(),
    deletionReason: reason,
  });
  return { deleted: true };
}

/**
 * Delete documents whose retention window has passed.
 * Intended to run on a timer in production; returns what it removed so a job
 * log can prove the cleaner actually ran.
 */
export async function purgeExpiredDocuments(now = new Date()) {
  const repo = getRepository();
  const candidates = await repo.findAll('documents', {});
  const expired = candidates.filter(
    (doc) => doc.expiresAt && new Date(doc.expiresAt).getTime() <= now.getTime(),
  );

  for (const doc of expired) {
    await deleteDocument(doc.id, { reason: 'expired' });
  }
  return { purged: expired.length };
}

/** Administrative view of a document without exposing its bytes. */
export function publicDocument(document) {
  if (!document) return null;
  return {
    id: document.id,
    originalName: document.originalName,
    pageCount: document.pageCount,
    sizeBytes: document.sizeBytes,
    uploadedAt: document.createdAt,
    expiresAt: document.expiresAt,
  };
}
