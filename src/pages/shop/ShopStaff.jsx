import { useState } from 'react';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Modal from '../../components/ui/Modal.jsx';
import Input from '../../components/ui/Input.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

const STAFF_ROLES = [
  { id: 'operator', label: 'Counter operator', permissions: 'View orders, manage print queue' },
  { id: 'manager', label: 'Manager', permissions: 'View orders, manage pricing, view reports' },
  { id: 'cashier', label: 'Cashier', permissions: 'View orders, handle payments' },
];

export default function ShopStaff() {
  const { user } = useAuth();
  const [showAddModal, setShowAddModal] = useState(false);
  const [staff, setStaff] = useState(() => getInitialStaff());
  const toast = useToast();

  function getInitialStaff() {
    // Use current user's info if available, otherwise fallback to shop data
    return [
      {
        id: 'staff_1',
        name: user?.name ?? 'Shop Owner',
        email: user?.email ?? '',
        role: 'owner',
        status: 'active',
        addedAt: '2025-01-15',
      },
    ];
  }

  const handleRemove = (id) => {
    setStaff((prev) => prev.filter((s) => s.id !== id));
    toast.success('Staff member removed');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff management"
        description="Manage staff accounts and permissions for your shop."
        action={
          <Button size="sm" onClick={() => setShowAddModal(true)}>
            Add staff
          </Button>
        }
      />

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-line text-[11px] uppercase tracking-wider text-ink-400">
                <th className="pb-3 pr-4 font-medium">Name</th>
                <th className="pb-3 pr-4 font-medium">Email</th>
                <th className="pb-3 pr-4 font-medium">Role</th>
                <th className="pb-3 pr-4 font-medium">Status</th>
                <th className="pb-3 pr-4 font-medium">Added</th>
                <th className="pb-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {staff.map((member) => (
                <tr key={member.id} className="group">
                  <td className="py-3 pr-4 font-medium text-ink-900">{member.name}</td>
                  <td className="py-3 pr-4 text-ink-600">{member.email}</td>
                  <td className="py-3 pr-4">
                    <Badge tone={member.role === 'owner' ? 'brand' : 'neutral'}>
                      {member.role === 'owner' ? 'Owner' : member.role}
                    </Badge>
                  </td>
                  <td className="py-3 pr-4">
                    <Badge tone={member.status === 'active' ? 'success' : 'neutral'}>
                      {member.status}
                    </Badge>
                  </td>
                  <td className="py-3 pr-4 text-ink-500">{member.addedAt}</td>
                  <td className="py-3 text-right">
                    {member.role !== 'owner' && (
                      <button
                        onClick={() => handleRemove(member.id)}
                        className="text-[12px] text-danger hover:text-danger/80 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {staff.length === 0 && (
          <div className="py-12 text-center text-[13px] text-ink-400">
            No staff members added yet.
          </div>
        )}
      </Card>

      <Card className="mt-4">
        <h3 className="text-[14px] font-semibold text-ink-900 mb-3">Available roles</h3>
        <div className="space-y-2">
          {STAFF_ROLES.map((role) => (
            <div key={role.id} className="flex items-start justify-between rounded-md border border-line p-3">
              <div>
                <p className="text-[13px] font-medium text-ink-900">{role.label}</p>
                <p className="text-[12px] text-ink-500">{role.permissions}</p>
              </div>
              <Badge tone="neutral">{role.id}</Badge>
            </div>
          ))}
        </div>
      </Card>

      <AddStaffModal open={showAddModal} onClose={() => setShowAddModal(false)} onAdd={(s) => {
        setStaff((prev) => [...prev, { ...s, id: `staff_${Date.now()}`, status: 'active', addedAt: new Date().toISOString().slice(0, 10) }]);
        toast.success('Staff member added');
        setShowAddModal(false);
      }} />
    </div>
  );
}

function AddStaffModal({ open, onClose, onAdd }) {
  const [form, setForm] = useState({ name: '', email: '', role: 'operator' });

  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose} title="Add staff member">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onAdd(form);
          setForm({ name: '', email: '', role: 'operator' });
        }}
        className="space-y-4"
      >
        <Input
          label="Full name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
        <Input
          label="Email"
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          required
        />
        <div>
          <label className="mb-1.5 block text-[12px] font-medium text-ink-700">Role</label>
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            className="w-full rounded-lg border border-line bg-white px-3 py-2 text-[13px] text-ink-900 focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          >
            {STAFF_ROLES.map((r) => (
              <option key={r.id} value={r.id}>{r.label}</option>
            ))}
          </select>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit">Add staff</Button>
        </div>
      </form>
    </Modal>
  );
}
