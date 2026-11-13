import { Link } from 'react-router-dom';
import { cn, initials } from '../../lib/utils.js';

const AVATAR_TONES = [
  'bg-brand-50 text-brand-700',
  'bg-emerald-50 text-emerald-700',
  'bg-amber-50 text-amber-700',
  'bg-violet-50 text-violet-700',
  'bg-sky-50 text-sky-700',
  'bg-rose-50 text-rose-700',
];

function hashName(name = '') {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) % 997;
  return hash;
}

export default function Avatar({ name = 'Unknown', size = 'md', className, tone }) {
  const sizes = {
    xs: 'size-6 text-[10px]',
    sm: 'size-7 text-[11px]',
    md: 'size-9 text-[12px]',
    lg: 'size-11 text-[14px]',
    xl: 'size-14 text-[16px]',
  };
  const color = tone ?? AVATAR_TONES[hashName(name) % AVATAR_TONES.length];
  return (
    <span
      className={cn(
        'inline-grid shrink-0 place-items-center rounded-full font-semibold uppercase tracking-wide',
        sizes[size],
        color,
        className,
      )}
      aria-hidden
    >
      {initials(name) || '?'}
    </span>
  );
}

export function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div
      className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)}
    >
      {Icon ? (
        <span className="mb-4 grid size-12 place-items-center rounded-xl border border-line bg-surface-muted text-ink-400">
          <Icon className="size-5" strokeWidth={1.8} />
        </span>
      ) : null}
      <h3 className="text-[15px] font-semibold text-ink-900">{title}</h3>
      {description ? (
        <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-ink-500">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function InlineLink({ to, children, className }) {
  return (
    <Link
      to={to}
      className={cn(
        'font-medium text-brand-600 underline-offset-4 transition-colors hover:text-brand-700 hover:underline',
        className,
      )}
    >
      {children}
    </Link>
  );
}
