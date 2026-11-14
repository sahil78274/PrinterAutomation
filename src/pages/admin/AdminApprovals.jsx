import { useState } from 'react';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Card from '../../components/ui/Card.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { db } from '../../services/db.js';

export default function AdminApprovals() {
  const [shops, setShops] = useState(() => getInitialShops());
  const toast = useToast();

  function getInitialShops() {
    return db.shops.map((shop) => ({
      ...shop,
      approvalStatus: shop.status === 'active' ? 'approved' : 'pending',
    }));
  }

  const pending = shops.filter((s) => s.approvalStatus === 'pending');
  const approved = shops.filter((s) => s.approvalStatus === 'approved');

  const handleApprove = (id) => {
    setShops((prev) =>
      prev.map((s) => (s.id === id ? { ...s, approvalStatus: 'approved', status: 'active' } : s))
    );
    toast.success('Shop approved');
  };

  const handleReject = (id) => {
    setShops((prev) =>
      prev.map((s) => (s.id === id ? { ...s, approvalStatus: 'rejected', status: 'suspended' } : s))
    );
    toast.success('Shop rejected');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Shop approvals"
        description="Review and approve new shop registrations."
      />

      <Card>
        <h3 className="mb-4 text-[14px] font-semibold text-ink-900">
          Pending approval ({pending.length})
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-line text-[11px] uppercase tracking-wider text-ink-400">
                <th className="pb-3 pr-4 font-medium">Shop</th>
                <th className="pb-3 pr-4 font-medium">Owner</th>
                <th className="pb-3 pr-4 font-medium">Email</th>
                <th className="pb-3 pr-4 font-medium">Plan</th>
                <th className="pb-3 pr-4 font-medium">Registered</th>
                <th className="pb-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {pending.map((shop) => (
                <tr key={shop.id}>
                  <td className="py-3 pr-4 font-medium text-ink-900">{shop.name}</td>
                  <td className="py-3 pr-4 text-ink-600">{shop.ownerName}</td>
                  <td className="py-3 pr-4 text-ink-600">{shop.email}</td>
                  <td className="py-3 pr-4"><Badge tone="neutral">{shop.planId}</Badge></td>
                  <td className="py-3 pr-4 text-ink-500">{shop.createdAt?.slice(0, 10) ?? '—'}</td>
                  <td className="py-3">
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleApprove(shop.id)}>Approve</Button>
                      <Button size="sm" variant="ghost" onClick={() => handleReject(shop.id)}>Reject</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pending.length === 0 && (
          <div className="py-8 text-center text-[13px] text-ink-400">
            No shops pending approval.
          </div>
        )}
      </Card>

      <Card>
        <h3 className="mb-4 text-[14px] font-semibold text-ink-900">
          Approved shops ({approved.length})
        </h3>
        <div className="space-y-2">
          {approved.map((shop) => (
            <div key={shop.id} className="flex items-center justify-between rounded-md border border-line px-4 py-3">
              <div>
                <p className="text-[13px] font-medium text-ink-900">{shop.name}</p>
                <p className="text-[12px] text-ink-500">{shop.ownerName} · {shop.email}</p>
              </div>
              <Badge tone="success">Approved</Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
