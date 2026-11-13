import { FlaskConical, Info, ShieldAlert } from 'lucide-react';
import { cn } from '../../lib/utils.js';

/**
 * Consistent labelling of simulated functionality.
 * Every non-production surface in SmartPrint carries one of these.
 */
export function MockBadge({ label = 'Demo data', className }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border border-warn/25 bg-warn/[0.07] px-2 py-0.5 text-[11px] font-medium text-warn',
        className,
      )}
      title="This interface runs on local sample data. No live backend is connected."
    >
      <FlaskConical className="size-3" strokeWidth={2.2} />
      {label}
    </span>
  );
}

export function MockNotice({ title, children, tone = 'warn', className, icon: Icon }) {
  const Tones = {
    warn: {
      wrap: 'border-warn/25 bg-warn/[0.045]',
      icon: 'text-warn',
      title: 'text-warn',
    },
    info: {
      wrap: 'border-brand-500/20 bg-brand-50/60',
      icon: 'text-brand-600',
      title: 'text-brand-700',
    },
    neutral: {
      wrap: 'border-line bg-surface-muted',
      icon: 'text-ink-400',
      title: 'text-ink-700',
    },
  };
  const toneStyles = Tones[tone];
  const IconComponent = Icon ?? (tone === 'info' ? Info : ShieldAlert);

  return (
    <div
      className={cn('flex items-start gap-3 rounded-xl border p-3.5', toneStyles.wrap, className)}
    >
      <IconComponent className={cn('mt-0.5 size-4 shrink-0', toneStyles.icon)} strokeWidth={2} />
      <div className="min-w-0">
        {title ? (
          <p className={cn('text-[12.5px] font-semibold', toneStyles.title)}>{title}</p>
        ) : null}
        <div className="mt-0.5 text-[12.5px] leading-relaxed text-ink-600">{children}</div>
      </div>
    </div>
  );
}
