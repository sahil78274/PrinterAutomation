import { useState } from 'react';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Card from '../../components/ui/Card.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import { useToast } from '../../context/ToastContext.jsx';

/**
 * Shop notifications page.
 * Shows order events, system alerts, and subscription notifications.
 * In production this would connect to the realtime service.
 */
export default function ShopNotifications() {
  const [notifications, setNotifications] = useState(getSampleNotifications());
  const [filter, setFilter] = useState('all');
  const toast = useToast();

  function getSampleNotifications() {
    return [
      { id: 'n1', type: 'order', title: 'New order received', message: 'Order SPO-7X9K2 — 3 copies, A4, B&W', time: '2 minutes ago', read: false, tone: 'info' },
      { id: 'n2', type: 'order', title: 'Order completed', message: 'Order SPO-5M3P1 has been printed and collected', time: '15 minutes ago', read: false, tone: 'success' },
      { id: 'n3', type: 'machine', title: 'Machine offline', message: 'Counter B printer has gone offline', time: '1 hour ago', read: true, tone: 'warning' },
      { id: 'n4', type: 'payment', title: 'Payment received', message: '₹24 settled for 3 orders', time: '2 hours ago', read: true, tone: 'success' },
      { id: 'n5', type: 'system', title: 'Print Agent updated', message: 'Agent v1.2.0 installed successfully', time: '1 day ago', read: true, tone: 'neutral' },
      { id: 'n6', type: 'subscription', title: 'Subscription renewal', message: 'Growth plan renews on 1 Dec 2026', time: '2 days ago', read: true, tone: 'neutral' },
    ];
  }

  const filtered = filter === 'all' ? notifications : notifications.filter((n) => n.type === filter);
  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    toast.success('All notifications marked as read');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description="Order events, system alerts, and account updates."
        action={
          unreadCount > 0 ? (
            <Button size="sm" variant="ghost" onClick={markAllRead}>
              Mark all read ({unreadCount})
            </Button>
          ) : null
        }
      />

      <div className="flex gap-2">
        {['all', 'order', 'machine', 'payment', 'system', 'subscription'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors ${
              filter === f ? 'bg-brand-50 text-brand-700' : 'text-ink-500 hover:text-ink-700 hover:bg-surface-muted'
            }`}
          >
            {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <Card>
        <div className="divide-y divide-line">
          {filtered.map((notification) => (
            <div
              key={notification.id}
              className={`flex items-start gap-4 px-4 py-4 ${!notification.read ? 'bg-brand-50/30' : ''}`}
            >
              <div className="mt-1">
                <span className={`block h-2 w-2 rounded-full ${
                  notification.tone === 'success' ? 'bg-success' :
                  notification.tone === 'warning' ? 'bg-warn' :
                  notification.tone === 'info' ? 'bg-brand-500' :
                  'bg-ink-300'
                }`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className={`text-[13px] ${!notification.read ? 'font-semibold text-ink-900' : 'text-ink-700'}`}>
                    {notification.title}
                  </p>
                  <Badge tone="neutral">{notification.type}</Badge>
                </div>
                <p className="mt-0.5 text-[12px] text-ink-500">{notification.message}</p>
                <p className="mt-1 text-[11px] text-ink-400">{notification.time}</p>
              </div>
              {!notification.read && (
                <button
                  onClick={() => setNotifications((prev) => prev.map((n) => n.id === notification.id ? { ...n, read: true } : n))}
                  className="text-[11px] text-ink-400 hover:text-ink-600"
                >
                  ✓
                </button>
              )}
            </div>
          ))}
        </div>
        {filtered.length === 0 && (
          <div className="py-12 text-center text-[13px] text-ink-400">
            No notifications in this category.
          </div>
        )}
      </Card>
    </div>
  );
}
