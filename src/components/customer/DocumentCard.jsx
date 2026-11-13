import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown, Droplets, FileText, Minus, Palette, Plus, Trash2 } from 'lucide-react';
import { cn, formatBytes, formatPageRanges, groupPages, parsePageRanges } from '../../lib/utils.js';
import { SegmentedControl } from '../ui/Input.jsx';
import Button from '../ui/Button.jsx';
import { FINISHING_OPTIONS } from '../../lib/constants.js';

export default function DocumentCard({
  document: doc,
  index,
  supportsColor,
  supportsDuplex,
  maxPaper,
  onUpdate,
  onRemove,
  quote,
}) {
  const [expanded, setExpanded] = useState(index === 0);
  const [pageInput, setPageInput] = useState('');
  const [pageError, setPageError] = useState('');

  const selectedCount = doc.selectedPages.length;
  const allSelected = selectedCount === doc.pageCount;

  const togglePage = (page) => {
    const exists = doc.selectedPages.includes(page);
    onUpdate({
      selectedPages: exists
        ? doc.selectedPages.filter((p) => p !== page)
        : [...doc.selectedPages, page].sort((a, b) => a - b),
    });
  };

  const applyRange = () => {
    const pages = parsePageRanges(pageInput, doc.pageCount);
    if (!pages.length) {
      setPageError(`Enter pages between 1 and ${doc.pageCount}, e.g. 1-3, 7`);
      return;
    }
    onUpdate({ selectedPages: pages });
    setPageError('');
    setPageInput('');
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className="overflow-hidden rounded-xl border border-line bg-white shadow-card"
    >
      {/* Header row */}
      <div className="flex items-start gap-3 p-4">
        <div className="relative shrink-0">
          {doc.preview ? (
            <img
              src={doc.preview}
              alt={`First page preview of ${doc.name}`}
              className="h-[62px] w-[46px] rounded border border-line object-cover object-top"
            />
          ) : (
            <div className="grid h-[62px] w-[46px] place-items-center rounded border border-line bg-surface-muted text-ink-400">
              <FileText className="size-4" />
            </div>
          )}
          <span className="absolute -bottom-1.5 -right-1.5 grid size-4 place-items-center rounded-full bg-white text-[9px] font-semibold text-ink-700 ring-1 ring-line">
            {index + 1}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-[13.5px] font-medium text-ink-900">{doc.name}</p>
              <p className="mt-0.5 text-[11.5px] text-ink-500">
                {doc.pageCount} page{doc.pageCount === 1 ? '' : 's'} ·{' '}
                {formatBytes(doc.sizeKb * 1024)}
                {allSelected ? '' : ` · ${selectedCount} selected`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onRemove(doc.id)}
              className="shrink-0 rounded-md p-1.5 text-ink-400 transition-colors hover:bg-danger/10 hover:text-danger"
              aria-label={`Remove ${doc.name}`}
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Chip>{quote.formatSides}</Chip>
            <Chip>{quote.formatColor}</Chip>
            <Chip>{doc.paper.toUpperCase()}</Chip>
            <Chip>
              {doc.copies} {doc.copies > 1 ? 'copies' : 'copy'}
            </Chip>
            {doc.finishing !== 'none' ? (
              <Chip>{FINISHING_OPTIONS.find((f) => f.id === doc.finishing)?.label}</Chip>
            ) : null}
          </div>
        </div>

        <div className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
          <p className="text-[15px] font-semibold tabular-nums text-ink-900">
            ₹{quote.total.toFixed(0)}
          </p>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex items-center gap-0.5 text-[11.5px] font-medium text-brand-600 hover:text-brand-700"
          >
            {expanded ? 'Hide' : 'Edit'}
            <ChevronDown className={cn('size-3 transition-transform', expanded && 'rotate-180')} />
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between border-t border-line px-4 py-2 text-[11.5px] font-medium text-ink-500 sm:hidden"
      >
        <span>₹{quote.total.toFixed(0)} total</span>
        <span className="inline-flex items-center gap-1 text-brand-600">
          {expanded ? 'Hide options' : 'Edit options'}
          <ChevronDown className={cn('size-3 transition-transform', expanded && 'rotate-180')} />
        </span>
      </button>

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden border-t border-line bg-surface-muted/40"
          >
            <div className="space-y-5 p-4">
              {/* Pages */}
              <section>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-500">
                    Pages
                  </p>
                  <div className="flex items-center gap-2 text-[11.5px]">
                    <button
                      type="button"
                      onClick={() =>
                        onUpdate({
                          selectedPages: allSelected
                            ? []
                            : Array.from({ length: doc.pageCount }, (_, i) => i + 1),
                        })
                      }
                      className="font-medium text-brand-600 hover:underline"
                    >
                      {allSelected ? 'Clear all' : 'Select all'}
                    </button>
                  </div>
                </div>

                {doc.pageCount <= 40 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {Array.from({ length: doc.pageCount }, (_, i) => i + 1).map((page) => {
                      const active = doc.selectedPages.includes(page);
                      return (
                        <button
                          key={page}
                          type="button"
                          onClick={() => togglePage(page)}
                          aria-pressed={active}
                          aria-label={`Page ${page}${active ? ' selected' : ''}`}
                          className={cn(
                            'grid size-8 place-items-center rounded-md border text-[11.5px] font-medium tabular-nums transition-all duration-150',
                            active
                              ? 'border-brand-600 bg-brand-600 text-white'
                              : 'border-line bg-white text-ink-600 hover:border-ink-300',
                          )}
                        >
                          {page}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div>
                    <div className="flex flex-wrap gap-1.5">
                      {groupPages(doc.selectedPages).map((group) => (
                        <span
                          key={group.start}
                          className="rounded-md border border-brand-200 bg-brand-50 px-2 py-1 text-[11.5px] font-medium tabular-nums text-brand-700"
                        >
                          {group.start === group.end ? group.start : `${group.start}–${group.end}`}
                        </span>
                      ))}
                    </div>
                    <p className="mt-2 text-[11.5px] text-ink-400">
                      {doc.pageCount} pages — use a range to select specific pages.
                    </p>
                  </div>
                )}

                <div className="mt-2.5 flex gap-1.5">
                  <input
                    value={pageInput}
                    onChange={(e) => {
                      setPageInput(e.target.value);
                      setPageError('');
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        applyRange();
                      }
                    }}
                    placeholder="e.g. 1-5, 9, 12-14"
                    className="field-sm flex-1"
                    aria-label="Page ranges"
                  />
                  <Button size="sm" variant="secondary" onClick={applyRange}>
                    Apply
                  </Button>
                </div>
                {pageError ? (
                  <p className="mt-1.5 text-[11.5px] text-danger">{pageError}</p>
                ) : selectedCount === 0 ? (
                  <p className="mt-1.5 text-[11.5px] text-warn">
                    Select at least one page to continue.
                  </p>
                ) : (
                  <p className="mt-1.5 text-[11.5px] text-ink-400">
                    Selected: {formatPageRanges(doc.selectedPages)}
                  </p>
                )}
              </section>

              {/* Options grid */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-500">
                    Colour
                  </p>
                  <SegmentedControl
                    value={doc.color ? 'color' : 'bw'}
                    onChange={(value) => onUpdate({ color: value === 'color' })}
                    options={[
                      { value: 'bw', label: 'B & W', icon: Droplets },
                      {
                        value: 'color',
                        label: 'Colour',
                        icon: Palette,
                        disabled: !supportsColor,
                        hint: supportsColor ? undefined : 'This machine is black & white only',
                      },
                    ]}
                  />
                </div>
                <div>
                  <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-500">
                    Sides
                  </p>
                  <SegmentedControl
                    value={doc.sides}
                    onChange={(value) => onUpdate({ sides: value })}
                    options={[
                      { value: 'single', label: 'Single' },
                      {
                        value: 'double',
                        label: 'Double',
                        disabled: !supportsDuplex,
                        hint: supportsDuplex ? undefined : 'Duplex not supported',
                      },
                    ]}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-500">
                    Copies
                  </p>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onUpdate({ copies: Math.max(1, doc.copies - 1) })}
                      disabled={doc.copies <= 1}
                      className="grid size-8 place-items-center rounded-md border border-line bg-white text-ink-600 transition-colors hover:bg-surface-muted disabled:opacity-40"
                      aria-label="Decrease copies"
                    >
                      <Minus className="size-3.5" />
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={doc.copies}
                      onChange={(e) =>
                        onUpdate({ copies: Math.min(99, Math.max(1, Number(e.target.value) || 1)) })
                      }
                      className="field-sm w-14 text-center tabular-nums"
                      aria-label="Number of copies"
                    />
                    <button
                      type="button"
                      onClick={() => onUpdate({ copies: Math.min(99, doc.copies + 1) })}
                      disabled={doc.copies >= 99}
                      className="grid size-8 place-items-center rounded-md border border-line bg-white text-ink-600 transition-colors hover:bg-surface-muted disabled:opacity-40"
                      aria-label="Increase copies"
                    >
                      <Plus className="size-3.5" />
                    </button>
                  </div>
                </div>

                <div>
                  <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-500">
                    Finishing
                  </p>
                  <select
                    value={doc.finishing}
                    onChange={(e) => onUpdate({ finishing: e.target.value })}
                    className="field-sm w-full"
                    aria-label="Finishing option"
                  >
                    {FINISHING_OPTIONS.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                        {option.price > 0 ? ` (+₹${option.price}/copy)` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {maxPaper === 'A3' ? (
                <div>
                  <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-500">
                    Paper size
                  </p>
                  <SegmentedControl
                    value={doc.paper}
                    onChange={(value) => onUpdate({ paper: value })}
                    options={[
                      { value: 'a4', label: 'A4' },
                      { value: 'a3', label: 'A3 · +60%' },
                    ]}
                  />
                </div>
              ) : null}

              {/* Per-doc totals */}
              <div className="rounded-lg border border-line bg-white p-3">
                <div className="flex items-center justify-between text-[11.5px] text-ink-500">
                  <span>
                    {quote.billableUnitsPerCopy} {quote.billingUnit}
                    {quote.billableUnitsPerCopy === 1 ? '' : 's'} × {doc.copies}{' '}
                    {doc.copies > 1 ? 'copies' : 'copy'} @ ₹{quote.unitPrice}/{quote.billingUnit}
                  </span>
                  <span className="tabular-nums text-ink-700">₹{quote.lineTotal.toFixed(2)}</span>
                </div>
                {quote.finishingTotal > 0 ? (
                  <div className="mt-1 flex items-center justify-between text-[11.5px] text-ink-500">
                    <span>Finishing</span>
                    <span className="tabular-nums text-ink-700">
                      ₹{quote.finishingTotal.toFixed(2)}
                    </span>
                  </div>
                ) : null}
                <div className="mt-2 flex items-center justify-between border-t border-line pt-2">
                  <span className="text-[12px] font-medium text-ink-700">Document total</span>
                  <span className="text-[14px] font-semibold tabular-nums text-ink-900">
                    ₹{quote.total.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}

function Chip({ children }) {
  return (
    <span className="inline-flex items-center rounded border border-line bg-surface-muted px-1.5 py-0.5 text-[10.5px] font-medium text-ink-600">
      {children}
    </span>
  );
}

export function SelectionSummary({ documents }) {
  return (
    <div className="flex flex-wrap gap-2 text-[11.5px] text-ink-500">
      <span className="inline-flex items-center gap-1">
        <Check className="size-3 text-success" /> {documents.length} document
        {documents.length === 1 ? '' : 's'}
      </span>
    </div>
  );
}
