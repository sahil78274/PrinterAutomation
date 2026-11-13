import { useCallback, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { FileText, Loader2, UploadCloud } from 'lucide-react';
import { cn, formatBytes } from '../../lib/utils.js';
import { getPdfJsErrorHint, inspectPdf, MAX_FILE_MB } from '../../lib/pdf.js';

/**
 * PDF drop zone. Reads the file locally to detect page count and preview —
 * nothing is uploaded in this preview build.
 */
export default function DocumentUploader({ onAdd, disabled, maxFiles = 5, currentCount = 0 }) {
  const [dragging, setDragging] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  const handleFiles = useCallback(
    async (fileList) => {
      setError(null);
      const files = Array.from(fileList ?? []);
      if (!files.length) return;

      if (currentCount >= maxFiles) {
        setError(`You can add up to ${maxFiles} documents per order.`);
        return;
      }

      const file = files[0];
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        setError(
          'Only PDF files are supported right now. Export your document as PDF and try again.',
        );
        return;
      }
      if (file.size > MAX_FILE_MB * 1024 * 1024) {
        setError(
          `This file is ${formatBytes(file.size)}. The limit is ${MAX_FILE_MB} MB per document.`,
        );
        return;
      }

      setReading(true);
      try {
        const info = await inspectPdf(file);
        onAdd({
          id: `doc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          file,
          name: file.name,
          pageCount: info.pageCount,
          pageRatio: info.pageRatio,
          preview: info.preview,
          sizeKb: info.sizeKb,
          selectedPages: Array.from({ length: info.pageCount }, (_, i) => i + 1),
          copies: 1,
          color: false,
          sides: 'single',
          paper: 'a4',
          finishing: 'none',
        });
      } catch (err) {
        setError(getPdfJsErrorHint(err));
      } finally {
        setReading(false);
        if (inputRef.current) inputRef.current.value = '';
      }
    },
    [currentCount, maxFiles, onAdd],
  );

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!disabled) handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          'relative rounded-xl border border-dashed transition-all duration-200 ease-premium',
          dragging ? 'border-brand-500 bg-brand-50/60' : 'border-line-strong bg-surface-muted/50',
          disabled && 'opacity-60',
        )}
      >
        <input
          ref={inputRef}
          id="document-upload"
          type="file"
          accept="application/pdf,.pdf"
          className="sr-only"
          disabled={disabled || reading}
          onChange={(e) => handleFiles(e.target.files)}
        />
        <label
          htmlFor="document-upload"
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center px-6 py-9 text-center',
            (disabled || reading) && 'cursor-not-allowed',
          )}
        >
          <div
            className={cn(
              'grid size-11 place-items-center rounded-xl border border-line bg-white text-ink-500 shadow-card transition-colors',
              dragging && 'border-brand-300 text-brand-600',
            )}
          >
            {reading ? (
              <Loader2 className="size-5 animate-spin text-brand-600" />
            ) : (
              <UploadCloud className="size-5" strokeWidth={1.8} />
            )}
          </div>
          <p className="mt-3.5 text-[13.5px] font-medium text-ink-900">
            {reading ? 'Reading your PDF…' : 'Drop your PDF here, or click to browse'}
          </p>
          <p className="mt-1 text-[12px] text-ink-500">
            PDF only · up to {MAX_FILE_MB} MB · up to {maxFiles} documents per order
          </p>
          <span className="mt-3.5 inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-2.5 py-1 text-[11.5px] font-medium text-ink-600">
            <FileText className="size-3" />
            {currentCount}/{maxFiles} added
          </span>
        </label>
      </div>

      {error ? (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-2.5 rounded-lg border border-danger/25 bg-danger/[0.04] px-3 py-2 text-[12.5px] text-danger"
        >
          {error}
        </motion.p>
      ) : null}
    </div>
  );
}
