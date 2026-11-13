import { Link } from 'react-router-dom';
import { FileStack, Printer, QrCode, Rss, Settings2 } from 'lucide-react';
import { MachineStatusBadge } from '../orders/OrderStatusBadge.jsx';
import { LevelBar } from '../charts/ProgressBar.jsx';
import { cn, formatCurrency, timeAgo } from '../../lib/utils.js';

export default function MachineCard({ machine, onQr, onConfigure }) {
  const connected = machine.agent.status === 'connected';

  return (
    <div className="card card-hover group flex flex-col overflow-hidden">
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={cn(
              'grid size-10 shrink-0 place-items-center rounded-lg transition-colors',
              machine.status === 'online' && 'bg-success/10 text-success',
              machine.status === 'busy' && 'bg-brand-50 text-brand-600',
              machine.status === 'offline' && 'bg-surface-sunken text-ink-400',
              machine.status === 'maintenance' && 'bg-warn/10 text-warn',
            )}
          >
            <Printer className="size-[18px]" strokeWidth={1.9} />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate text-[13.5px] font-semibold text-ink-900">{machine.name}</p>
              <span className="shrink-0 rounded bg-surface-sunken px-1.5 py-0.5 font-mono text-[10px] font-medium text-ink-500">
                {machine.id}
              </span>
            </div>
            <p className="mt-0.5 truncate text-[11.5px] text-ink-500">{machine.model}</p>
          </div>
        </div>
        <MachineStatusBadge status={machine.status} size="sm" />
      </div>

      <div className="grid grid-cols-3 gap-3 border-y border-line bg-surface-muted/40 px-4 py-3">
        <Metric label="Today" value={machine.jobsToday} sub="jobs" />
        <Metric label="Lifetime" value={machine.totalJobs.toLocaleString('en-IN')} sub="jobs" />
        <Metric
          label="Revenue"
          value={formatCurrency(machine.lifetimeRevenue, { compact: true })}
          sub="total"
        />
      </div>

      <div className="space-y-2.5 px-4 py-3.5">
        <LevelBar label="Paper" value={machine.paperLevel} />
        <LevelBar label="Toner" value={machine.tonerLevel} />
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-line px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] font-medium',
              connected ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger',
            )}
            title={`Agent ${machine.agent.name} ${connected ? 'connected' : 'disconnected'}`}
          >
            <Rss className="size-2.5" />
            {connected ? 'Agent live' : 'Agent offline'}
          </span>
          <span className="truncate text-[10.5px] text-ink-400">
            {machine.lastHeartbeat ? timeAgo(machine.lastHeartbeat) : 'never'}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => onQr?.(machine)}
            className="rounded-md p-1.5 text-ink-400 transition-colors hover:bg-surface-sunken hover:text-ink-800"
            aria-label={`Show QR code for ${machine.id}`}
            title="QR code"
          >
            <QrCode className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onConfigure?.(machine)}
            className="rounded-md p-1.5 text-ink-400 transition-colors hover:bg-surface-sunken hover:text-ink-800"
            aria-label={`Configure ${machine.id}`}
            title="Configure"
          >
            <Settings2 className="size-3.5" />
          </button>
          <Link
            to={`/print/${machine.id}`}
            className="rounded-md p-1.5 text-ink-400 transition-colors hover:bg-surface-sunken hover:text-ink-800"
            aria-label={`Open customer portal for ${machine.id}`}
            title="Customer view"
          >
            <FileStack className="size-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, sub }) {
  return (
    <div>
      <p className="text-[10.5px] uppercase tracking-[0.06em] text-ink-400">{label}</p>
      <p className="mt-0.5 truncate text-[13px] font-semibold tabular-nums text-ink-900">{value}</p>
      <p className="text-[10px] text-ink-400">{sub}</p>
    </div>
  );
}

export function MachineListRow({ machine }) {
  return (
    <div className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-0">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-sunken text-ink-500">
        <Printer className="size-4" strokeWidth={1.9} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12.5px] font-medium text-ink-900">
          {machine.name} <span className="font-mono text-[10.5px] text-ink-400">{machine.id}</span>
        </p>
        <p className="truncate text-[11px] text-ink-500">{machine.model}</p>
      </div>
      <MachineStatusBadge status={machine.status} size="sm" />
    </div>
  );
}
