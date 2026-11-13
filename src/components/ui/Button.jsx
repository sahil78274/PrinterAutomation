import { forwardRef } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils.js';

const VARIANTS = {
  primary:
    'bg-brand-600 text-white shadow-[0_1px_2px_rgba(11,29,58,0.16)] hover:bg-brand-700 active:bg-brand-800 disabled:bg-brand-300',
  secondary:
    'bg-white text-ink-900 border border-line-strong shadow-card hover:bg-surface-muted hover:border-ink-300 active:bg-surface-sunken disabled:text-ink-300',
  dark: 'bg-ink-900 text-white hover:bg-ink-800 active:bg-ink-950 disabled:bg-ink-600',
  ghost: 'text-ink-600 hover:bg-surface-sunken hover:text-ink-900 disabled:text-ink-300',
  danger: 'bg-danger text-white hover:bg-red-700 active:bg-red-800 disabled:bg-red-300',
  subtle: 'bg-brand-50 text-brand-700 hover:bg-brand-100 disabled:text-brand-300',
};

const SIZES = {
  sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-lg',
  lg: 'h-11 px-5 text-[15px] gap-2 rounded-lg',
  xl: 'h-12 px-6 text-[15px] gap-2.5 rounded-xl',
  icon: 'size-9 rounded-lg',
};

const Button = forwardRef(function Button(
  {
    as,
    to,
    href,
    variant = 'primary',
    size = 'md',
    loading = false,
    icon: Icon,
    iconRight: IconRight,
    className,
    children,
    disabled,
    ...props
  },
  ref,
) {
  const classes = cn(
    'inline-flex select-none items-center justify-center whitespace-nowrap font-medium transition-all duration-200 ease-premium disabled:cursor-not-allowed',
    VARIANTS[variant],
    SIZES[size],
    className,
  );

  const content = (
    <>
      {loading ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : Icon ? (
        <Icon className={cn(size === 'sm' ? 'size-3.5' : 'size-4')} strokeWidth={2} aria-hidden />
      ) : null}
      {children}
      {IconRight && !loading ? (
        <IconRight
          className={cn(size === 'sm' ? 'size-3.5' : 'size-4')}
          strokeWidth={2}
          aria-hidden
        />
      ) : null}
    </>
  );

  if (to) {
    return (
      <Link ref={ref} to={to} className={classes} {...props}>
        {content}
      </Link>
    );
  }

  if (href) {
    return (
      <a ref={ref} href={href} className={classes} {...props}>
        {content}
      </a>
    );
  }

  const Component = as || 'button';
  return (
    <Component ref={ref} className={classes} disabled={disabled || loading} {...props}>
      {content}
    </Component>
  );
});

export default Button;
