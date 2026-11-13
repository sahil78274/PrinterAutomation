import { useId, useMemo, useState } from 'react';
import { cn, formatCurrency, formatNumber } from '../../lib/utils.js';

/**
 * Responsive SVG area chart with hover tooltip.
 * Hand-rolled so the bundle stays small and styling stays consistent.
 */
export default function AreaChart({
  data = [],
  xKey = 'label',
  yKey = 'value',
  height = 220,
  valueFormat = 'number',
  color = '#2459E8',
  className,
  showGrid = true,
  showAxis = true,
}) {
  const gradientId = useId().replace(/:/g, '');
  const [hovered, setHovered] = useState(null);

  const W = 720;
  const H = height;
  const padTop = 14;
  const padBottom = showAxis ? 26 : 8;
  const padLeft = showAxis ? 44 : 8;
  const padRight = 8;

  const { points, max, min, ticks } = useMemo(() => {
    const values = data.map((d) => Number(d[yKey]) || 0);
    const rawMax = Math.max(...values, 1);
    const rawMin = Math.min(...values, 0);
    const span = rawMax - rawMin || 1;
    const niceMax = rawMax + span * 0.12;
    const innerW = W - padLeft - padRight;
    const innerH = H - padTop - padBottom;

    const pts = data.map((d, i) => {
      const x = padLeft + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
      const y = padTop + innerH - ((Number(d[yKey]) - rawMin) / (niceMax - rawMin)) * innerH;
      return { x, y, datum: d };
    });

    const tickCount = 4;
    const tickValues = Array.from({ length: tickCount + 1 }).map(
      (_, i) => rawMin + ((niceMax - rawMin) / tickCount) * i,
    );

    return { points: pts, max: niceMax, min: rawMin, ticks: tickValues };
  }, [data, yKey, H, padBottom, padLeft]);

  const innerW = W - padLeft - padRight;
  const innerH = H - padTop - padBottom;

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(' ');

  const areaPath = points.length
    ? `${linePath} L${points[points.length - 1].x.toFixed(2)},${(padTop + innerH).toFixed(2)} L${points[0].x.toFixed(2)},${(padTop + innerH).toFixed(2)} Z`
    : '';

  const fmt = (v) => (valueFormat === 'currency' ? formatCurrency(v) : formatNumber(Math.round(v)));

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
    <div className={cn('relative w-full', className)}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height }}
        role="img"
        aria-label="Revenue trend chart"
        onMouseLeave={() => setHovered(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.16" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {showGrid
          ? ticks.map((tick, i) => {
              const y = padTop + innerH - ((tick - min) / (max - min)) * innerH;
              return (
                <g key={i}>
                  <line
                    x1={padLeft}
                    x2={W - padRight}
                    y1={y}
                    y2={y}
                    stroke="#E6E9EF"
                    strokeWidth="1"
                    strokeDasharray={i === 0 ? '0' : '3 4'}
                  />
                  {showAxis ? (
                    <text
                      x={padLeft - 10}
                      y={y + 3.5}
                      textAnchor="end"
                      className="fill-ink-400"
                      style={{ fontSize: 10, fontVariantNumeric: 'tabular-nums' }}
                    >
                      {valueFormat === 'currency'
                        ? tick >= 1000
                          ? `${Math.round(tick / 1000)}k`
                          : Math.round(tick)
                        : Math.round(tick)}
                    </text>
                  ) : null}
                </g>
              );
            })
          : null}

        <path d={areaPath} fill={`url(#${gradientId})`} />
        <path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {hovered !== null ? (
          <>
            <line
              x1={points[hovered].x}
              x2={points[hovered].x}
              y1={padTop}
              y2={padTop + innerH}
              stroke={color}
              strokeWidth="1"
              strokeDasharray="3 3"
              opacity="0.5"
            />
            <circle
              cx={points[hovered].x}
              cy={points[hovered].y}
              r="5.5"
              fill="#fff"
              stroke={color}
              strokeWidth="2.5"
            />
          </>
        ) : null}

        {showAxis
          ? points.map((p, i) => {
              const showLabel =
                data.length <= 8 || i % Math.ceil(data.length / 7) === 0 || i === data.length - 1;
              if (!showLabel) return null;
              return (
                <text
                  key={i}
                  x={p.x}
                  y={H - 8}
                  textAnchor={i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'}
                  className="fill-ink-400"
                  style={{ fontSize: 10 }}
                >
                  {p.datum[xKey]}
                </text>
              );
            })
          : null}

        {points.map((p, i) => (
          <rect
            key={i}
            x={p.x - innerW / (data.length * 2 || 1)}
            y={padTop}
            width={Math.max(innerW / (data.length || 1), 8)}
            height={innerH}
            fill="transparent"
            onMouseEnter={() => setHovered(i)}
          />
        ))}
      </svg>

      {hovered !== null ? (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-line bg-white px-2.5 py-1.5 text-[11.5px] shadow-raised"
          style={{
            left: `${(points[hovered].x / W) * 100}%`,
            top: `${(points[hovered].y / H) * 100}%`,
            marginTop: -8,
          }}
        >
          <p className="font-medium text-ink-900">{fmt(points[hovered].datum[yKey])}</p>
          <p className="text-ink-400">{points[hovered].datum[xKey]}</p>
        </div>
      ) : null}
    </div>
  );
}
