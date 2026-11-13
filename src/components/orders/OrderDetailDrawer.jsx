import { useState } from 'react';
import {
  Ban,
  CheckCircle2,
  Clock,
  CreditCard,
  FileText,
  FlaskConical,
  Printer,
  RotateCw,
  User,
} from 'lucide-react';
import Modal, { ModalBody, ModalFooter, ModalHeader } from '../ui/Modal.jsx';
import Button from '../ui/Button.jsx';
import { OrderStatusBadge } from './OrderStatusBadge.jsx';
import { refundOrder, updateOrderStatus } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { ORDER_STATUS } from '../../lib/constants.js';
import { formatCurrency, formatDateTime, formatPageRanges } from '../../lib/utils.js';
import { formatColor, formatSides } from '../../lib/pricing.js';
import { MockNotice } from '../ui/MockNotice.jsx';

export default function OrderDetailDrawer({ order, open, onClose, onChanged, showShop = false }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  if (!order) return null;
  const canRefund = [ORDER_STATUS.COMPLETED, ORDER_STATUS.PAID, ORDER_STATUS.FAILED].includes(
    order.status,
  );

  const act = async (action, label, fn) => {
    setBusy(true);
    try {
      await fn();
      toast({ type: 'success', title: label, description: `Order ${order.id} updated.` });
      onChanged?.();
      onClose();
    } catch (error) {
      toast({ type: 'error', title: 'Action failed', description: error.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} labelledBy="order-detail-title" className="sm:max-w-2xl">
      <ModalHeader
        id="order-detail-title"
        title={`Order ${order.id}`}
        description={`${order.machineName} · ${order.shopName}`}
        icon={FileText}
        onClose={onClose}
      />

      <ModalBody className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface-muted/50 px-3.5 py-3">
          <div>
            <p className="text-[10.5px] uppercase tracking-[0.08em] text-ink-400">Status</p>
            <div className="mt-1">
              <OrderStatusBadge status={order.status} />
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10.5px] uppercase tracking-[0.08em] text-ink-400">Amount</p>
            <p className="mt-0.5 text-[18px] font-semibold tabular-nums tracking-tight text-ink-900">
              {formatCurrency(order.amount, { decimals: order.amount % 1 === 0 ? 0 : 2 })}
            </p>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[12px]">
          <Field icon={Clock} label="Placed" value={formatDateTime(order.createdAt)} />
          <Field
            icon={CheckCircle2}
            label="Completed"
            value={order.completedAt ? formatDateTime(order.completedAt) : '—'}
          />
          <Field icon={User} label="Customer" value={order.customerName} />
          <Field
            icon={CreditCard}
            label="Payment"
            value={`${order.paymentMethod ?? '—'} · ${order.paymentStatus}`}
          />
          {showShop ? <Field label="Shop" value={order.shopName} /> : null}
          <Field label="Machine" value={`${order.machineId} · ${order.machineName}`} />
        </dl>

        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-400">
            Documents
          </p>
          <div className="divide-y divide-line rounded-lg border border-line">
            {(order.documents ?? []).map((doc) => (
              <div key={doc.id} className="flex items-start gap-2.5 px-3.5 py-2.5">
                <FileText className="mt-0.5 size-3.5 shrink-0 text-ink-300" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-medium text-ink-900">{doc.name}</p>
                  <p className="text-[11px] text-ink-500">
                    {doc.selectedPages?.length ?? doc.pages} pages · {formatColor(doc.color)} ·{' '}
                    {formatSides(doc.sides)} · {doc.copies}× · {String(doc.paper).toUpperCase()}
                    {doc.finishing && doc.finishing !== 'none' ? ` · ${doc.finishing}` : ''}
                  </p>
                  {doc.selectedPages && doc.selectedPages.length !== doc.pages ? (
                    <p className="mt-0.5 font-mono text-[10.5px] text-ink-400">
                      {formatPageRanges(doc.selectedPages)}
                    </p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-line p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-400">
            Ledger
          </p>
          <div className="space-y-1.5 text-[12px]">
            <div className="flex justify-between">
              <span className="text-ink-500">Customer paid</span>
              <span className="tabular-nums text-ink-900">
                {formatCurrency(order.amount, { decimals: 2 })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-500">Platform fee</span>
              <span className="tabular-nums text-ink-600">
                −{formatCurrency(order.platformFee ?? 0, { decimals: 2 })}
              </span>
            </div>
            <div className="flex justify-between border-t border-line pt-1.5 font-medium">
              <span className="text-ink-700">Shop earning</span>
              <span className="tabular-nums text-ink-900">
                {formatCurrency(order.shopEarning ?? order.amount - (order.platformFee ?? 0), {
                  decimals: 2,
                })}
              </span>
            </div>
            <div className="flex justify-between pt-1">
              <span className="text-ink-400">Payment ref</span>
              <span className="font-mono text-[10.5px] text-ink-500">
                {order.paymentRef ?? '—'}
              </span>
            </div>
          </div>
        </div>

        <MockNotice tone="warn" icon={FlaskConical}>
          Status changes, refunds and reprints here are simulated in the browser. In production
          these call the Express API, are audit-logged, and refunds go through the payment gateway.
        </MockNotice>
      </ModalBody>

      <ModalFooter className="flex-wrap">
        {order.status !== ORDER_STATUS.REFUNDED && canRefund ? (
          <Button
            variant="secondary"
            size="sm"
            icon={RotateCw}
            loading={busy}
            onClick={() => act('refund', 'Refund simulated', () => refundOrder(order.id))}
          >
            Simulate refund
          </Button>
        ) : null}
        {[ORDER_STATUS.QUEUED, ORDER_STATUS.PAID, ORDER_STATUS.PRINTING].includes(order.status) ? (
          <Button
            variant="secondary"
            size="sm"
            icon={Ban}
            loading={busy}
            onClick={() =>
              act('cancel', 'Job cancelled', () => updateOrderStatus(order.id, ORDER_STATUS.FAILED))
            }
          >
            Mark failed
          </Button>
        ) : null}
        {order.status !== ORDER_STATUS.COMPLETED ? (
          <Button
            size="sm"
            icon={Printer}
            loading={busy}
            onClick={() =>
              act('complete', 'Marked complete', () =>
                updateOrderStatus(order.id, ORDER_STATUS.COMPLETED),
              )
            }
          >
            Mark completed
          </Button>
        ) : (
          <Button size="sm" variant="secondary" onClick={onClose}>
            Close
          </Button>
        )}
      </ModalFooter>
    </Modal>
  );
}

function Field({ icon: Icon, label, value }) {
  return (
    <div>
      <dt className="flex items-center gap-1 text-[10.5px] uppercase tracking-[0.06em] text-ink-400">
        {Icon ? <Icon className="size-2.5" /> : null}
        {label}
      </dt>
      <dd className="mt-0.5 truncate text-[12px] font-medium text-ink-900" title={String(value)}>
        {value}
      </dd>
    </div>
  );
}
