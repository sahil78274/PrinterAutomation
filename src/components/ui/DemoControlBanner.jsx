import { FlaskConical, PlugZap } from 'lucide-react';
import { isLiveMode } from '../../services/api.js';

/**
 * Persistent reminder of where the data on this screen comes from.
 *
 * The banner must never lie about the source. In mock mode every figure is
 * local sample data and nothing reaches a server. In live mode the figures are
 * real records from the API — but payments are still simulated and no printer
 * is involved, so the banner says exactly that instead of claiming otherwise.
 */
export default function DemoControlBanner() {
  if (isLiveMode) {
    return (
      <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-warn/25 bg-warn/[0.05] px-3.5 py-2.5">
        <PlugZap className="mt-0.5 size-3.5 shrink-0 text-warn" strokeWidth={2} />
        <p className="text-[11.5px] leading-relaxed text-ink-600">
          <span className="font-semibold text-warn">Live API, simulated payments.</span> These
          figures come from the real backend and are computed from stored records. Payments are
          simulated — no gateway is contacted and no money moves — and no paper is printed unless a
          Print Agent is running against a real printer.
        </p>
      </div>
    );
  }

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
