import { useMemo } from 'react';
import { cn, formatNumber } from '../../lib/utils.js';

const PALETTE = ['#2459E8', '#6094FA', '#0E9F6E', '#C27803', '#7A8DA8', '#DC2626'];

export default function DonutChart({
  data = [],
  size = 168,
  thickness = 16,
  centerLabel,
  centerValue,
  className,
}) {
  const total = data.reduce((sum, d) => sum + Number(d.value || 0), 0);

  const segments = useMemo(() => {
    const radius = (size - thickness) / 2;
    const circumference = 2 * Math.PI * radius;
    let offset = 0;
    return data.map((d, i) => {
      const fraction = total ? Number(d.value) / total : 0;
      const length = fraction * circumference;
      const segment = {
        ...d,
        color: d.color ?? PALETTE[i % PALETTE.length],
        dash: `${length} ${circumference - length}`,
        offset: -offset,
        radius,
        circumference,
        percent: total ? Math.round(fraction * 100) : 0,
      };
      offset += length;
      return segment;
    });
  }, [data, size, thickness, total]);

  return (
    <div className={cn('flex items-center gap-6', className)}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" aria-hidden>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={(size - thickness) / 2}
            fill="none"
            stroke="#F2F4F7"
            strokeWidth={thickness}
          />
          {segments.map((s, i) => (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={s.radius}
              fill="none"
              stroke={s.color}
              strokeWidth={thickness}
              strokeDasharray={s.dash}
              strokeDashoffset={s.offset}
              strokeLinecap="butt"
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[20px] font-semibold tracking-tight text-ink-900">
            {centerValue ?? formatNumber(total)}
          </span>
          {centerLabel ? (
            <span className="mt-0.5 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-400">
              {centerLabel}
            </span>
          ) : null}
        </div>
      </div>

      <ul className="min-w-0 flex-1 space-y-2">
        {segments.map((s, i) => (
          <li key={i} className="flex items-center gap-2 text-[12.5px]">
            <span
              className="size-2 shrink-0 rounded-[2px]"
              style={{ backgroundColor: s.color }}
              aria-hidden
            />
            <span className="min-w-0 flex-1 truncate text-ink-600">{s.label}</span>
            <span className="font-medium tabular-nums text-ink-900">{formatNumber(s.value)}</span>
            <span className="w-8 text-right text-[11px] tabular-nums text-ink-400">
              {s.percent}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
