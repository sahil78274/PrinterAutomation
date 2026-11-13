import { useState } from 'react';
import { cn, formatCurrency, formatNumber } from '../../lib/utils.js';

export default function BarChart({
  data = [],
  xKey = 'label',
  yKey = 'value',
  height = 220,
  valueFormat = 'number',
  color = '#2459E8',
  className,
}) {
  const [hovered, setHovered] = useState(null);
  const max = Math.max(...data.map((d) => Number(d[yKey]) || 0), 1);
  const fmt = (v) => (valueFormat === 'currency' ? formatCurrency(v) : formatNumber(v));

  if (!data.length) {
    return (
      <div
        className={cn(
          'grid place-items-center rounded-lg bg-surface-muted text-[13px] text-ink-400',
          className,
        )}
        style={{ height }}
      >
        No data for this period
      </div>
    );
  }

  return (
    <div className={cn('w-full', className)}>
      <div className="flex items-end gap-1.5" style={{ height }}>
        {data.map((datum, i) => {
          const value = Number(datum[yKey]) || 0;
          const pct = Math.max((value / max) * 100, 1.5);
          const isHovered = hovered === i;
          return (
            <div
              key={i}
              className="group relative flex h-full flex-1 flex-col justify-end"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              {isHovered ? (
                <div className="absolute -top-1 left-1/2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg border border-line bg-white px-2.5 py-1.5 text-[11.5px] shadow-raised">
                  <p className="font-medium text-ink-900">{fmt(value)}</p>
                  <p className="text-ink-400">{datum[xKey]}</p>
                </div>
              ) : null}
              <div
                className="w-full rounded-t-[3px] transition-all duration-300 ease-premium"
                style={{
                  height: `${pct}%`,
                  backgroundColor: isHovered ? '#1D46C7' : color,
                  opacity: hovered === null || isHovered ? 1 : 0.45,
                }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-1.5">
        {data.map((datum, i) => (
          <div
            key={i}
            className={cn(
              'flex-1 truncate text-center text-[10px] transition-colors',
              hovered === i ? 'font-medium text-ink-700' : 'text-ink-400',
            )}
          >
            {data.length <= 10 || i % 2 === 0 ? datum[xKey] : ''}
          </div>
        ))}
      </div>
    </div>
  );
}
