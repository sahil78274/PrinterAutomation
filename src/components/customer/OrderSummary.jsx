import { FileText } from 'lucide-react';
import { formatCurrency } from '../../lib/utils.js';

export default function OrderSummary({ items, totals, machineName, children }) {
  return (
    <div className="card overflow-hidden">
      <div className="border-b border-line px-4 py-3.5">
        <h2 className="text-[13.5px] font-semibold text-ink-900">Order summary</h2>
        <p className="mt-0.5 text-[11.5px] text-ink-400">Printing at {machineName}</p>
      </div>

      <div className="max-h-[320px] space-y-3 overflow-y-auto px-4 py-3.5">
        {items.length === 0 ? (
          <p className="py-4 text-center text-[12.5px] text-ink-400">
            Add a document to see the price breakdown.
          </p>
        ) : (
          items.map((item) => (
            <div key={item.id} className="flex items-start gap-2.5">
              <FileText className="mt-0.5 size-3.5 shrink-0 text-ink-300" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-medium text-ink-900">{item.name}</p>
                <p className="mt-0.5 text-[11px] leading-snug text-ink-500">{item.detail}</p>
              </div>
              <span className="shrink-0 text-[12px] font-medium tabular-nums text-ink-800">
                {formatCurrency(item.amount, { decimals: 2 })}
              </span>
            </div>
          ))
        )}
      </div>

      <div className="space-y-2 border-t border-line bg-surface-muted/50 px-4 py-3.5 text-[12.5px]">
        <Row label="Subtotal" value={formatCurrency(totals.subtotal, { decimals: 2 })} />
        {totals.minimumTopUp > 0 ? (
          <Row
            label="Minimum order adjustment"
            value={formatCurrency(totals.minimumTopUp, { decimals: 2 })}
            muted
          />
        ) : null}
        <Row label="Platform fee" value="Included" muted />
        <div className="flex items-baseline justify-between border-t border-line pt-2.5">
          <span className="text-[13px] font-semibold text-ink-900">Total payable</span>
          <span className="text-[19px] font-semibold tabular-nums tracking-tight text-ink-900">
            {formatCurrency(totals.total, { decimals: totals.total % 1 === 0 ? 0 : 2 })}
          </span>
        </div>
        <p className="pt-0.5 text-[10.5px] leading-relaxed text-ink-400">
          Price includes paper and printing. Payable at the machine on collection.
        </p>
      </div>

      {children ? <div className="border-t border-line p-4">{children}</div> : null}
    </div>
  );
}

function Row({ label, value, muted }) {
  return (
    <div className="flex items-center justify-between">
      <span className={muted ? 'text-ink-400' : 'text-ink-600'}>{label}</span>
      <span className={`tabular-nums ${muted ? 'text-ink-400' : 'text-ink-800'}`}>{value}</span>
    </div>
  );
}
