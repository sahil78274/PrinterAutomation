import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  CircleDashed,
  Clock,
  FileText,
  FlaskConical,
  Loader2,
  Printer,
  Receipt,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';
import Logo from '../../components/ui/Logo.jsx';
import Button from '../../components/ui/Button.jsx';
import { MockNotice } from '../../components/ui/MockNotice.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';
import { getOrder } from '../../services/api.js';
import { db } from '../../services/db.js';
import { ORDER_STATUS, ORDER_STATUS_META } from '../../lib/constants.js';
import { cn, formatCurrency, formatDateTime, formatPageRanges, timeAgo } from '../../lib/utils.js';
import { formatColor, formatSides } from '../../lib/pricing.js';

const FLOW = [
  {
    id: ORDER_STATUS.QUEUED,
    label: 'Queued at machine',
    icon: CircleDashed,
    description: 'Waiting for the print agent to pick up the job.',
  },
  {
    id: ORDER_STATUS.PRINTING,
    label: 'Printing',
    icon: Printer,
    description: 'The agent is sending pages to the printer.',
  },
  {
    id: ORDER_STATUS.COMPLETED,
    label: 'Completed',
    icon: CheckCircle2,
    description: 'All pages printed. Collect from the counter.',
  },
];

export default function OrderTracking() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const timerRef = useRef(null);

  const load = async () => {
    setLoading(true);
    try {
      const result = await getOrder(orderId);
      setOrder(result);
    } catch {
      setOrder(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  /** Local-only demo: advance the job through the agent lifecycle. */
  const simulateAdvance = () => {
    if (!order) return;
    const next =
      order.status === ORDER_STATUS.QUEUED
        ? ORDER_STATUS.PRINTING
        : order.status === ORDER_STATUS.PRINTING
          ? ORDER_STATUS.COMPLETED
          : null;
    if (!next) return;
    setSimulating(true);
    timerRef.current = setTimeout(() => {
      const target = db.orders.find((o) => o.id === order.id);
      if (target) {
        target.status = next;
        if (next === ORDER_STATUS.COMPLETED) target.completedAt = new Date().toISOString();
      }
      setOrder({
        ...order,
        status: next,
        completedAt: next === ORDER_STATUS.COMPLETED ? new Date().toISOString() : null,
      });
      setSimulating(false);
    }, 1600);
  };

  if (loading) {
    return (
      <Shell>
        <div className="card space-y-4 p-6">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-64" />
          <Skeleton className="h-32 w-full rounded-lg" />
        </div>
      </Shell>
    );
  }

  if (!order) {
    return (
      <Shell>
        <div className="card p-7 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-xl bg-surface-sunken text-ink-400">
            <Receipt className="size-5" />
          </span>
          <h1 className="mt-4 text-[19px] font-semibold text-ink-900">Order not found</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-500">
            We could not find an order with reference{' '}
            <span className="font-mono text-ink-700">{orderId}</span>. Order lookups only cover jobs
            created in this browser session.
          </p>
          <Button className="mt-5 w-full" to="/print/SP-001">
            Start a new print job
          </Button>
        </div>
      </Shell>
    );
  }

  const meta = ORDER_STATUS_META[order.status] ?? ORDER_STATUS_META.queued;
  const currentIndex = FLOW.findIndex((f) => f.id === order.status);
  const effectiveIndex = currentIndex === -1 ? 0 : currentIndex;
  const isFinal = order.status === ORDER_STATUS.COMPLETED;
  const canAdvance =
    order.simulated && [ORDER_STATUS.QUEUED, ORDER_STATUS.PRINTING].includes(order.status);

  return (
    <Shell>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="space-y-4"
      >
        {/* Status hero */}
        <div className="card overflow-hidden">
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3.5">
              <span
                className={cn(
                  'grid size-11 shrink-0 place-items-center rounded-xl',
                  isFinal ? 'bg-success/10 text-success' : 'bg-brand-50 text-brand-600',
                )}
              >
                {isFinal ? (
                  <Check className="size-5" strokeWidth={2.4} />
                ) : (
                  <Loader2 className="size-5 animate-spin" strokeWidth={2.2} />
                )}
              </span>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-400">
                  Order {order.id}
                </p>
                <h1 className="mt-0.5 text-[20px] font-semibold tracking-[-0.02em] text-ink-900">
                  {meta.label}
                </h1>
                <p className="mt-1 text-[12.5px] text-ink-500">
                  {order.machineName} · {order.shopName}
                </p>
              </div>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-[22px] font-semibold tabular-nums tracking-tight text-ink-900">
                {formatCurrency(order.amount, { decimals: order.amount % 1 === 0 ? 0 : 2 })}
              </p>
              <p className="text-[11.5px] text-ink-400">{formatDateTime(order.createdAt)}</p>
            </div>
          </div>

          {order.simulated ? (
            <div className="flex items-center gap-2 border-t border-warn/20 bg-warn/[0.05] px-5 py-2.5">
              <FlaskConical className="size-3.5 shrink-0 text-warn" />
              <p className="text-[11.5px] font-medium text-warn">
                Simulated order — payment was not actually collected and no printer was contacted.
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-2 border-t border-line bg-surface-muted/60 px-5 py-2.5">
              <FlaskConical className="size-3.5 shrink-0 text-ink-400" />
              <p className="text-[11.5px] text-ink-500">
                Sample historical order from the demo dataset.
              </p>
            </div>
          )}
        </div>

        {/* Progress */}
        <div className="card p-5">
          <h2 className="text-[13.5px] font-semibold text-ink-900">Print status</h2>
          <div className="mt-4 space-y-0">
            {FLOW.map((stage, index) => {
              const done = index < effectiveIndex || isFinal;
              const active = index === effectiveIndex && !isFinal;
              const Icon = done ? Check : stage.icon;
              return (
                <div key={stage.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span
                      className={cn(
                        'grid size-7 shrink-0 place-items-center rounded-full transition-colors',
                        done && 'bg-success text-white',
                        active && 'bg-brand-600 text-white',
                        !done && !active && 'bg-surface-sunken text-ink-400',
                      )}
                    >
                      {active ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Icon className="size-3.5" strokeWidth={2.4} />
                      )}
                    </span>
                    {index < FLOW.length - 1 ? (
                      <span
                        className={cn('my-1 w-px flex-1', done ? 'bg-success/40' : 'bg-line')}
                        style={{ minHeight: 28 }}
                      />
                    ) : null}
                  </div>
                  <div className={cn('pb-5', index === FLOW.length - 1 && 'pb-0')}>
                    <p
                      className={cn(
                        'text-[12.5px] font-medium',
                        done || active ? 'text-ink-900' : 'text-ink-400',
                      )}
                    >
                      {stage.label}
                    </p>
                    <p className="mt-0.5 text-[11.5px] leading-snug text-ink-500">
                      {stage.description}
                    </p>
                    {active ? (
                      <p className="mt-1 inline-flex items-center gap-1 rounded bg-brand-50 px-1.5 py-0.5 text-[10.5px] font-medium text-brand-700">
                        <Clock className="size-2.5" /> in progress
                      </p>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          {canAdvance ? (
            <div className="mt-4 border-t border-line pt-4">
              <Button
                variant="secondary"
                size="sm"
                onClick={simulateAdvance}
                loading={simulating}
                icon={simulating ? undefined : RefreshCw}
              >
                {simulating ? 'Talking to print agent…' : 'Simulate next agent update'}
              </Button>
              <p className="mt-1.5 text-[11px] text-ink-400">
                Demo control — a real job receives these updates from the shop&apos;s print agent
                over WebSocket/polling.
              </p>
            </div>
          ) : null}
        </div>

        {/* Documents */}
        <div className="card">
          <div className="border-b border-line px-5 py-3.5">
            <h2 className="text-[13.5px] font-semibold text-ink-900">Documents</h2>
          </div>
          <div className="divide-y divide-line">
            {(order.documents ?? []).map((doc) => (
              <div key={doc.id} className="flex items-start gap-3 px-5 py-3.5">
                <FileText className="mt-0.5 size-4 shrink-0 text-ink-300" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-medium text-ink-900">{doc.name}</p>
                  <p className="mt-0.5 text-[11.5px] text-ink-500">
                    {doc.selectedPages?.length ?? doc.pages} pages · {formatColor(doc.color)} ·{' '}
                    {formatSides(doc.sides)} · {doc.copies}× · {doc.paper.toUpperCase()}
                  </p>
                  {doc.selectedPages?.length && doc.selectedPages.length !== doc.pages ? (
                    <p className="mt-0.5 font-mono text-[10.5px] text-ink-400">
                      Selected: {formatPageRanges(doc.selectedPages)}
                    </p>
                  ) : null}
                </div>
                {doc.amount !== undefined ? (
                  <span className="shrink-0 text-[12px] font-medium tabular-nums text-ink-700">
                    {formatCurrency(doc.amount, { decimals: 2 })}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between border-t border-line bg-surface-muted/50 px-5 py-3">
            <div className="text-[11.5px] text-ink-500">
              Payment · {order.paymentMethod ?? '—'} ·{' '}
              <span className="font-mono text-[10.5px] text-ink-400">
                {order.paymentRef ?? 'n/a'}
              </span>
            </div>
            <span className="text-[12px] font-semibold tabular-nums text-ink-900">
              {formatCurrency(order.amount, { decimals: order.amount % 1 === 0 ? 0 : 2 })}
            </span>
          </div>
        </div>

        <MockNotice title="This is a preview" tone="warn">
          Order status is stored in memory for this browser session only. Refresh-safe persistence,
          real payment reconciliation and agent communication arrive with the Node.js/Express
          backend.
        </MockNotice>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button className="flex-1" to={`/print/${order.machineId}`} icon={RotateCcw}>
            Print another document
          </Button>
          <Button
            className="flex-1"
            variant="secondary"
            onClick={() => navigate('/')}
            iconRight={ArrowRight}
          >
            Done
          </Button>
        </div>

        <p className="pb-2 text-center text-[11px] text-ink-400">
          Need help? Show this order ID to staff: <span className="font-mono">{order.id}</span> ·{' '}
          {order.simulated ? 'created ' : 'created '}
          {timeAgo(order.createdAt)}
        </p>
      </motion.div>
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div className="min-h-screen bg-surface-muted/70">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex h-14 w-full max-w-[720px] items-center justify-between px-4 sm:px-6">
          <Logo size={24} to="/" />
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ink-500 hover:text-ink-900"
          >
            <ArrowLeft className="size-3.5" />
            Home
          </Link>
        </div>
      </header>
      <div className="mx-auto w-full max-w-[720px] px-4 py-6 sm:px-6">{children}</div>
    </div>
  );
}
