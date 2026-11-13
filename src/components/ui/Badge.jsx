import { cn } from '../../lib/utils.js';
import { STATUS_TONES } from '../../lib/constants.js';

export default function Badge({
  children,
  tone = 'neutral',
  size = 'md',
  dot = false,
  className,
  ...props
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md font-medium ring-1 ring-inset',
        size === 'sm' ? 'px-1.5 py-0.5 text-[11px]' : 'px-2 py-0.5 text-[12px]',
        STATUS_TONES[tone] ?? STATUS_TONES.neutral,
        className,
      )}
      {...props}
    >
      {dot ? <span className="size-1.5 rounded-full bg-current" aria-hidden /> : null}
      {children}
    </span>
  );
}

export function StatusDot({ className, pulse = false }) {
  return (
    <span className={cn('relative inline-flex size-2', className)}>
      {pulse ? (
        <span className="absolute inset-0 animate-pulse-ring rounded-full bg-current opacity-60" />
      ) : null}
      <span className="relative inline-flex size-2 rounded-full bg-current" />
    </span>
  );
}
