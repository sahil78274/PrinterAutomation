import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Clock, CreditCard, FileText, FlaskConical, Printer, User } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Card, { CardHeader } from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';
import { EmptyState } from '../../components/ui/Avatar.jsx';
import { OrderStatusBadge } from '../../components/orders/OrderStatusBadge.jsx';
import { MockNotice } from '../../components/ui/MockNotice.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { getOrder } from '../../services/api.js';
import { formatCurrency, formatDateTime, formatPageRanges } from '../../lib/utils.js';
import { formatColor, formatSides } from '../../lib/pricing.js';
import { ORDER_STATUS, ORDER_STATUS_META } from '../../lib/constants.js';

export default function ShopOrderDetail() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { data: order, loading } = useAsync(() => getOrder(orderId), [orderId]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!order) {
    return (
      <Card>
        <EmptyState
          icon={FileText}
          title="Order not found"
          description={`No job with reference ${orderId} exists in this session.`}
          action={<Button to="/shop/orders">Back to orders</Button>}
        />
      </Card>
    );
  }

  const meta = ORDER_STATUS_META[order.status];

  return (
    <div className="space-y-5">
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-500 transition-colors hover:text-ink-900"
      >
        <ArrowLeft className="size-3.5" />
        Back
      </button>

      <PageHeader
        eyebrow={`Job · ${order.id}`}
        title={meta?.label ?? 'Print job'}
        description={`${order.machineId} · ${order.machineName} · placed ${formatDateTime(order.createdAt)}`}
        actions={
          <>
            <Button variant="secondary" size="md" to="/shop/orders">
              All orders
            </Button>
            <Button variant="secondary" size="md" to={`/print/${order.machineId}`}>
              Customer view
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Documents"
              description="Exactly what was sent to the printer"
              icon={FileText}
            />
            <div className="divide-y divide-line border-t border-line">
              {(order.documents ?? []).map((doc) => (
                <div key={doc.id} className="px-5 py-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 truncate text-[13px] font-medium text-ink-900">
                      {doc.name}
                    </p>
                    {doc.amount !== undefined ? (
                      <span className="shrink-0 text-[12.5px] font-medium tabular-nums text-ink-800">
                        {formatCurrency(doc.amount, { decimals: 2 })}
                      </span>
                    ) : null}
                  </div>
                  <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11.5px] sm:grid-cols-4">
                    <Spec label="Pages" value={doc.selectedPages?.length ?? doc.pages} />
                    <Spec label="Copies" value={doc.copies} />
                    <Spec label="Colour" value={formatColor(doc.color)} />
                    <Spec label="Sides" value={formatSides(doc.sides)} />
                    <Spec label="Paper" value={String(doc.paper).toUpperCase()} />
                    <Spec
                      label="Finishing"
                      value={doc.finishing && doc.finishing !== 'none' ? doc.finishing : 'Plain'}
                    />
                    <Spec label="File size" value={doc.sizeKb ? `${doc.sizeKb} KB` : '—'} />
                    <Spec label="Detected pages" value={doc.pages} />
                  </dl>
                  {doc.selectedPages && doc.selectedPages.length !== doc.pages ? (
                    <p className="mt-2 rounded bg-surface-muted px-2 py-1 font-mono text-[10.5px] text-ink-600">
                      Printed pages: {formatPageRanges(doc.selectedPages)}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Job lifecycle"
              description="Status transitions recorded for this order"
              icon={Clock}
            />
            <div className="px-5 pb-5">
              <ol className="relative space-y-4 border-l border-line pl-5">
                {[
                  { key: 'created', label: 'Order created', at: order.createdAt, done: true },
                  {
                    key: 'paid',
                    label: 'Payment captured',
                    at: order.createdAt,
                    done: order.paymentStatus !== 'pending',
                  },
                  {
                    key: 'queued',
                    label: 'Queued at print agent',
                    at: order.createdAt,
                    done: !['awaiting_payment', 'paid'].includes(order.status),
                  },
                  {
                    key: 'printing',
                    label: 'Printing started',
                    at: order.createdAt,
                    done: ['printing', 'completed'].includes(order.status),
                  },
                  {
                    key: 'completed',
                    label: 'Completed',
                    at: order.completedAt,
                    done: order.status === ORDER_STATUS.COMPLETED,
                  },
                ].map((event) => (
                  <li key={event.key} className="relative">
                    <span
                      className={`absolute -left-[26px] top-1 size-2.5 rounded-full ring-2 ring-white ${
                        event.done ? 'bg-success' : 'bg-line-strong'
                      }`}
                    />
                    <p
                      className={`text-[12.5px] font-medium ${event.done ? 'text-ink-900' : 'text-ink-400'}`}
                    >
                      {event.label}
                    </p>
                    <p className="text-[11px] text-ink-400">
                      {event.at ? formatDateTime(event.at) : 'pending'}
                    </p>
                  </li>
                ))}
              </ol>
              <MockNotice className="mt-4" tone="neutral" icon={FlaskConical}>
                Timeline timestamps are approximated from the demo dataset. Real jobs receive
                per-event timestamps from the print agent.
              </MockNotice>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Payment" icon={CreditCard} />
            <div className="space-y-2.5 px-5 pb-5 text-[12.5px]">
              <Line
                label="Customer paid"
                value={formatCurrency(order.amount, { decimals: 2 })}
                strong
              />
              <Line
                label="Platform fee"
                value={`− ${formatCurrency(order.platformFee ?? 0, { decimals: 2 })}`}
              />
              <div className="h-px bg-line" />
              <Line
                label="Shop earning"
                value={formatCurrency(order.shopEarning ?? order.amount, { decimals: 2 })}
                strong
              />
              <div className="h-px bg-line" />
              <Line label="Method" value={order.paymentMethod ?? '—'} />
              <Line label="State" value={order.paymentStatus} />
              <Line
                label="Reference"
                value={<span className="font-mono text-[10.5px]">{order.paymentRef ?? '—'}</span>}
              />
            </div>
          </Card>

          <Card>
            <CardHeader title="Identifiers" icon={Printer} />
            <div className="space-y-2.5 px-5 pb-5 text-[12.5px]">
              <Line label="Order ID" value={<span className="font-mono">{order.id}</span>} />
              <Line
                label="Machine ID"
                value={<span className="font-mono">{order.machineId}</span>}
              />
              <Line
                label="Shop"
                value={
                  <Link to="/shop/settings" className="text-brand-600 hover:underline">
                    {order.shopName}
                  </Link>
                }
              />
              <Line
                label="Customer"
                value={
                  <span className="inline-flex items-center gap-1">
                    <User className="size-3 text-ink-400" />
                    {order.customerName}
                  </span>
                }
              />
              <Line label="Status" value={<OrderStatusBadge status={order.status} size="sm" />} />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Spec({ label, value }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-[0.06em] text-ink-400">{label}</dt>
      <dd className="mt-0.5 font-medium text-ink-800">{value}</dd>
    </div>
  );
}

function Line({ label, value, strong }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-ink-500">{label}</span>
      <span
        className={`min-w-0 truncate text-right ${strong ? 'font-semibold text-ink-900' : 'text-ink-800'} tabular-nums`}
      >
        {value}
      </span>
    </div>
  );
}
