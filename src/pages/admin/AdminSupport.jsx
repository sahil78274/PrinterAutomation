import { useState } from 'react';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Card from '../../components/ui/Card.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import { useToast } from '../../context/ToastContext.jsx';

const SAMPLE_TICKETS = [
  { id: 'TK-001', subject: 'Print quality issue on SP-001', customer: 'Customer', shop: 'Sharma Digital Press', status: 'open', priority: 'medium', created: '2026-11-14' },
  { id: 'TK-002', subject: 'Payment deducted but order not placed', customer: 'Customer', shop: 'Campus Copy Centre', status: 'open', priority: 'high', created: '2026-11-14' },
  { id: 'TK-003', subject: 'Cannot upload PDF larger than 10MB', customer: 'Customer', shop: 'Sharma Digital Press', status: 'resolved', priority: 'low', created: '2026-11-13' },
  { id: 'TK-004', subject: 'Print Agent not connecting', customer: 'Shop Owner', shop: 'Digital Prints Hub', status: 'open', priority: 'high', created: '2026-11-13' },
  { id: 'TK-005', subject: 'Refund request for failed print', customer: 'Customer', shop: 'Sharma Digital Press', status: 'pending', priority: 'medium', created: '2026-11-12' },
  { id: 'TK-006', subject: 'How to change pricing for A3', customer: 'Shop Owner', shop: 'Campus Copy Centre', status: 'resolved', priority: 'low', created: '2026-11-11' },
];

const STATUS_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'pending', label: 'Pending' },
  { id: 'resolved', label: 'Resolved' },
];

export default function AdminSupport() {
  const [filter, setFilter] = useState('all');
  const toast = useToast();

  const filtered = filter === 'all' ? SAMPLE_TICKETS : SAMPLE_TICKETS.filter((t) => t.status === filter);

  const openCount = SAMPLE_TICKETS.filter((t) => t.status === 'open').length;
  const pendingCount = SAMPLE_TICKETS.filter((t) => t.status === 'pending').length;

  const handleResolve = (id) => {
    toast.success(`Ticket ${id} marked as resolved`);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Support tickets" description="Customer and shop owner support requests." />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-line p-4">
          <p className="text-[12px] text-ink-500">Open</p>
          <p className="mt-1 text-[24px] font-semibold text-ink-900 tabular-nums">{openCount}</p>
        </div>
        <div className="rounded-lg border border-line p-4">
          <p className="text-[12px] text-ink-500">Pending</p>
          <p className="mt-1 text-[24px] font-semibold text-ink-900 tabular-nums">{pendingCount}</p>
        </div>
        <div className="rounded-lg border border-line p-4">
          <p className="text-[12px] text-ink-500">Total</p>
          <p className="mt-1 text-[24px] font-semibold text-ink-900 tabular-nums">{SAMPLE_TICKETS.length}</p>
        </div>
      </div>

      <div className="flex gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors ${
              filter === f.id ? 'bg-brand-50 text-brand-700' : 'text-ink-500 hover:text-ink-700 hover:bg-surface-muted'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-line text-[11px] uppercase tracking-wider text-ink-400">
                <th className="pb-3 pr-4 font-medium">Ticket</th>
                <th className="pb-3 pr-4 font-medium">Subject</th>
                <th className="pb-3 pr-4 font-medium">From</th>
                <th className="pb-3 pr-4 font-medium">Shop</th>
                <th className="pb-3 pr-4 font-medium">Priority</th>
                <th className="pb-3 pr-4 font-medium">Status</th>
                <th className="pb-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filtered.map((ticket) => (
                <tr key={ticket.id}>
                  <td className="py-3 pr-4 font-medium text-ink-900">{ticket.id}</td>
                  <td className="py-3 pr-4 text-ink-700 max-w-[200px] truncate">{ticket.subject}</td>
                  <td className="py-3 pr-4 text-ink-600">{ticket.customer}</td>
                  <td className="py-3 pr-4 text-ink-600">{ticket.shop}</td>
                  <td className="py-3 pr-4">
                    <Badge tone={ticket.priority === 'high' ? 'danger' : ticket.priority === 'medium' ? 'warning' : 'neutral'}>
                      {ticket.priority}
                    </Badge>
                  </td>
                  <td className="py-3 pr-4">
                    <Badge tone={ticket.status === 'open' ? 'info' : ticket.status === 'pending' ? 'warning' : 'success'}>
                      {ticket.status}
                    </Badge>
                  </td>
                  <td className="py-3">
                    {ticket.status !== 'resolved' && (
                      <Button size="sm" variant="ghost" onClick={() => handleResolve(ticket.id)}>
                        Resolve
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="py-12 text-center text-[13px] text-ink-400">
            No tickets in this category.
          </div>
        )}
      </Card>
    </div>
  );
}
