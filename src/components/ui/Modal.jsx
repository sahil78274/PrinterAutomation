import { cn } from '../../lib/utils.js';

export function Modal({ open, onClose, children, className, labelledBy }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center p-0 sm:items-center sm:p-6">
      <div
        className="absolute inset-0 bg-ink-950/40 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={cn(
          'relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border border-line bg-white shadow-pop animate-fade-up sm:max-w-lg sm:rounded-2xl',
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function ModalHeader({ title, description, onClose, icon: Icon, id }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
      <div className="flex items-start gap-3">
        {Icon ? (
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600">
            <Icon className="size-[18px]" strokeWidth={2} />
          </span>
        ) : null}
        <div>
          <h2 id={id} className="text-[15px] font-semibold text-ink-900">
            {title}
          </h2>
          {description ? (
            <p className="mt-0.5 text-[13px] leading-snug text-ink-500">{description}</p>
          ) : null}
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-surface-muted hover:text-ink-800"
        aria-label="Close dialog"
      >
        <svg
          viewBox="0 0 16 16"
          className="size-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
        >
          <path d="m4 4 8 8M12 4l-8 8" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

export function ModalBody({ className, children }) {
  return <div className={cn('px-5 py-4', className)}>{children}</div>;
}

export function ModalFooter({ className, children }) {
  return (
    <div
      className={cn(
        'flex items-center justify-end gap-2 border-t border-line bg-surface-muted/60 px-5 py-3.5',
        className,
      )}
    >
      {children}
    </div>
  );
}

export default Modal;
