import { LogoMark } from './Logo.jsx';

export default function PageLoader({ label = 'Loading SmartPrint' }) {
  return (
    <div className="grid min-h-screen place-items-center bg-white">
      <div className="flex flex-col items-center gap-3">
        <div className="relative">
          <span className="absolute inset-0 animate-pulse-ring rounded-xl bg-brand-500/25" />
          <LogoMark size={40} className="relative" />
        </div>
        <p className="text-[12px] font-medium tracking-wide text-ink-400">{label}…</p>
      </div>
    </div>
  );
}
