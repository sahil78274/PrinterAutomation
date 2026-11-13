/**
 * PDF handling.
 *
 * Real page counts and first-page thumbnails are extracted from the uploaded
 * file with pdf.js. The PDF never leaves the browser in this frontend preview —
 * a production build would upload it to object storage and hand a signed URL to
 * the local Print Agent.
 */

let pdfjsPromise = null;

async function getPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const pdfjs = await import('pdfjs-dist');
      const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
      return pdfjs;
    })().catch((error) => {
      pdfjsPromise = null;
      throw error;
    });
  }
  return pdfjsPromise;
}

export const MAX_FILE_MB = 25;

export async function inspectPdf(file, { thumbnail = true } = {}) {
  const arrayBuffer = await file.arrayBuffer();
  const pdfjs = await getPdfjs();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;

  let preview = null;
  if (thumbnail) {
    try {
      const page = await doc.getPage(1);
      const baseViewport = page.getViewport({ scale: 1 });
      const targetWidth = 220;
      const scale = targetWidth / baseViewport.width;
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext('2d');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: context, viewport }).promise;
      preview = canvas.toDataURL('image/jpeg', 0.72);
    } catch {
      preview = null;
    }
  }

  const firstPage = await doc.getPage(1).catch(() => null);
  const viewport = firstPage?.getViewport({ scale: 1 });
  const ratio = viewport ? viewport.width / viewport.height : 1;

  const result = {
    pageCount: doc.numPages,
    pageRatio: ratio,
    preview,
    sizeKb: Math.round(file.size / 1024),
  };

  await doc.destroy();
  return result;
}

export function getPdfJsErrorHint(error) {
  const message = String(error?.message ?? error ?? '');
  if (/password/i.test(message))
    return 'This PDF is password protected. Please upload an unlocked copy.';
  if (/InvalidPDF|Invalid PDF/i.test(message)) {
    return 'This file is not a valid PDF. Try re-exporting it from your original application.';
  }
  return message || 'We could not read this PDF.';
}
