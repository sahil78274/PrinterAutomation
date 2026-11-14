import { useState } from 'react';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Card from '../../components/ui/Card.jsx';
import Badge from '../../components/ui/Badge.jsx';

const SAMPLE_LOGS = [
  { id: '1', timestamp: '2026-11-14T10:30:00Z', action: 'auth.login', actor: 'owner@smartprint.in', entity: 'user', details: 'Successful login' },
  { id: '2', timestamp: '2026-11-14T10:28:00Z', action: 'order.created', actor: 'anonymous', entity: 'printOrder', details: 'Order SPO-7X9K2 created for SP-001' },
  { id: '3', timestamp: '2026-11-14T10:25:00Z', action: 'machine.created', actor: 'owner@smartprint.in', entity: 'machine', details: 'Machine SP-003 registered' },
  { id: '4', timestamp: '2026-11-14T09:15:00Z', action: 'payment.confirmed', actor: 'system', entity: 'printOrder', details: 'Payment of ₹18 confirmed for SPO-5M3P1' },
  { id: '5', timestamp: '2026-11-14T08:45:00Z', action: 'shop.registered', actor: 'newshop@example.com', entity: 'shop', details: 'New shop registered' },
  { id: '6', timestamp: '2026-11-13T18:20:00Z', action: 'auth.login_failed', actor: 'unknown@test.com', entity: 'user', details: 'Invalid credentials (attempt 3)' },
  { id: '7', timestamp: '2026-11-13T17:00:00Z', action: 'subscription.renewed', actor: 'system', entity: 'shop', details: 'Growth plan renewed for shop_hsr_01' },
  { id: '8', timestamp: '2026-11-13T15:30:00Z', action: 'machine.status_changed', actor: 'agent', entity: 'machine', details: 'SP-001 went offline' },
  { id: '9', timestamp: '2026-11-13T12:00:00Z', action: 'pricing.updated', actor: 'campus@smartprint.in', entity: 'machine', details: 'B&W rate changed to ₹2.50 for SP-005' },
  { id: '10', timestamp: '2026-11-13T10:00:00Z', action: 'admin.shop_approved', actor: 'admin@smartprint.in', entity: 'shop', details: 'Shop approved' },
];

const ACTION_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'auth', label: 'Auth' },
  { id: 'order', label: 'Orders' },
  { id: 'payment', label: 'Payments' },
  { id: 'machine', label: 'Machines' },
  { id: 'shop', label: 'Shops' },
  { id: 'subscription', label: 'Subscriptions' },
];

export default function AdminAuditLogs() {
  const [filter, setFilter] = useState('all');

  const filtered = filter === 'all'
    ? SAMPLE_LOGS
    : SAMPLE_LOGS.filter((log) => log.action.startsWith(filter));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit logs"
        description="Platform-wide activity log for security and compliance."
      />

      <div className="flex flex-wrap gap-2">
        {ACTION_FILTERS.map((f) => (
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
                <th className="pb-3 pr-4 font-medium">Timestamp</th>
                <th className="pb-3 pr-4 font-medium">Action</th>
                <th className="pb-3 pr-4 font-medium">Actor</th>
                <th className="pb-3 pr-4 font-medium">Entity</th>
                <th className="pb-3 font-medium">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filtered.map((log) => (
                <tr key={log.id}>
                  <td className="py-3 pr-4 text-[12px] text-ink-500 tabular-nums">
                    {new Date(log.timestamp).toLocaleString('en-IN')}
                  </td>
                  <td className="py-3 pr-4">
                    <Badge tone="neutral">{log.action}</Badge>
                  </td>
                  <td className="py-3 pr-4 text-ink-700">{log.actor}</td>
                  <td className="py-3 pr-4 text-ink-600">{log.entity}</td>
                  <td className="py-3 text-ink-600">{log.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="py-12 text-center text-[13px] text-ink-400">
            No audit logs matching this filter.
          </div>
        )}
      </Card>
    </div>
  );
}
