import { cn } from '../../lib/utils.js';

export default function PageHeader({ title, description, actions, children, className, eyebrow }) {
  return (
    <div
      className={cn('flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between', className)}
    >
      <div className="min-w-0">
        {eyebrow ? <p className="eyebrow mb-1.5">{eyebrow}</p> : null}
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.025em] text-ink-900 sm:text-[24px]">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-[13.5px] leading-relaxed text-ink-500">{description}</p>
        ) : null}
        {children}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
