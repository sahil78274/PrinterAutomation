import { FlaskConical } from 'lucide-react';

/**
 * Persistent reminder that the environment is a local preview.
 * Rendered once in each dashboard shell so no screen can be mistaken for live data.
 */
export default function DemoControlBanner() {
  return (
    <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-warn/25 bg-warn/[0.05] px-3.5 py-2.5">
      <FlaskConical className="mt-0.5 size-3.5 shrink-0 text-warn" strokeWidth={2} />
      <p className="text-[11.5px] leading-relaxed text-ink-600">
        <span className="font-semibold text-warn">Preview environment.</span> All shops, machines,
        orders and payments below are local sample data stored in memory. Nothing is sent to a
        server, a payment gateway or a printer.
      </p>
    </div>
  );
}
