import { useState } from 'react';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Card from '../../components/ui/Card.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import { db } from '../../services/db.js';
import { ORDER_STATUS_META } from '../../lib/constants.js';

export default function ShopPrintQueue() {
  const [filter, setFilter] = useState('active');
  const orders = db.orders.slice(0, 20);

  const activeOrders = orders.filter((o) =>
    ['awaiting_payment', 'paid', 'queued', 'printing'].includes(o.status)
  );
  const completedOrders = orders.filter((o) =>
    ['completed', 'failed', 'cancelled'].includes(o.status)
  );

  const displayed = filter === 'active' ? activeOrders : completedOrders;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Print queue"
        description="Active jobs waiting to be printed and recent completions."
      />

      <div className="flex gap-2">
        <button
          onClick={() => setFilter('active')}
          className={`rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors ${
            filter === 'active' ? 'bg-brand-50 text-brand-700' : 'text-ink-500 hover:text-ink-700 hover:bg-surface-muted'
          }`}
        >
          Active ({activeOrders.length})
        </button>
        <button
          onClick={() => setFilter('completed')}
          className={`rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors ${
            filter === 'completed' ? 'bg-brand-50 text-brand-700' : 'text-ink-500 hover:text-ink-700 hover:bg-surface-muted'
          }`}
        >
          Completed ({completedOrders.length})
        </button>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-line text-[11px] uppercase tracking-wider text-ink-400">
                <th className="pb-3 pr-4 font-medium">Order</th>
                <th className="pb-3 pr-4 font-medium">Document</th>
                <th className="pb-3 pr-4 font-medium">Specs</th>
                <th className="pb-3 pr-4 font-medium">Amount</th>
                <th className="pb-3 pr-4 font-medium">Status</th>
                <th className="pb-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {displayed.map((order) => {
                const meta = ORDER_STATUS_META[order.status] ?? { label: order.status, tone: 'neutral' };
                return (
                  <tr key={order.id}>
                    <td className="py-3 pr-4">
                      <p className="font-medium text-ink-900">{order.id.slice(0, 8)}</p>
                      <p className="text-[11px] text-ink-400">{order.createdAt}</p>
                    </td>
                    <td className="py-3 pr-4">
                      <p className="text-ink-700 truncate max-w-[160px]">{order.documentName}</p>
                      <p className="text-[11px] text-ink-400">{order.pageCount} pages</p>
                    </td>
                    <td className="py-3 pr-4 text-ink-600">
                      {order.copies}× · {order.color ? 'Color' : 'B&W'} · {order.sides === 'duplex' ? '2-sided' : '1-sided'}
                    </td>
                    <td className="py-3 pr-4 font-medium text-ink-900 tabular-nums">
                      ₹{(order.totalPaise / 100).toFixed(2)}
                    </td>
                    <td className="py-3 pr-4">
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                    </td>
                    <td className="py-3">
                      {order.status === 'queued' && (
                        <Button size="sm" variant="ghost">Start print</Button>
                      )}
                      {order.status === 'printing' && (
                        <Button size="sm" variant="ghost">Mark done</Button>
                      )}
                      {['completed', 'failed', 'cancelled'].includes(order.status) && (
                        <span className="text-[12px] text-ink-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {displayed.length === 0 && (
          <div className="py-12 text-center text-[13px] text-ink-400">
            {filter === 'active' ? 'No active print jobs.' : 'No completed jobs yet.'}
          </div>
        )}
      </Card>
    </div>
  );
}
