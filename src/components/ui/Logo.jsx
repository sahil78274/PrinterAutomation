import { Link } from 'react-router-dom';
import { cn } from '../../lib/utils.js';

export function LogoMark({ size = 28, className }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={cn('shrink-0', className)}
      aria-hidden
    >
      <rect width="32" height="32" rx="8" fill="#0B1D3A" />
      <path
        d="M10 11.5h8.2c1.6 0 2.9 1.3 2.9 2.9S19.8 17.3 18.2 17.3H13"
        stroke="#fff"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      <path d="M13 17.3v6.2" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" />
      <path
        d="M20.5 20.6h1.2M20.5 23.1h1.2"
        stroke="#6094FA"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      <rect x="13" y="7.5" width="9.3" height="4" rx="1.4" stroke="#6094FA" strokeWidth="1.6" />
    </svg>
  );
}

export default function Logo({ size = 28, className, to = '/', showText = true, subtitle }) {
  const content = (
    <>
      <LogoMark size={size} />
      {showText ? (
        <span className="flex flex-col leading-none">
          <span className="text-[15.5px] font-semibold tracking-[-0.02em] text-ink-900">
            Smart<span className="text-brand-600">Print</span>
          </span>
          {subtitle ? (
            <span className="mt-1 text-[10px] font-medium uppercase tracking-[0.12em] text-ink-400">
              {subtitle}
            </span>
          ) : null}
        </span>
      ) : null}
    </>
  );

  if (!to) return <div className={cn('flex items-center gap-2.5', className)}>{content}</div>;

  return (
    <Link
      to={to}
      className={cn('flex items-center gap-2.5', className)}
      aria-label="SmartPrint home"
    >
      {content}
    </Link>
  );
}
