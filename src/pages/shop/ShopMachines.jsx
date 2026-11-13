import { useState } from 'react';
import { Cpu, Plus, Printer, QrCode, RefreshCw, Search } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import MachineCard from '../../components/shop/MachineCard.jsx';
import QrModal from '../../components/machines/QrModal.jsx';
import MachineConfigModal from '../../components/shop/MachineConfigModal.jsx';
import { FilterTabs, SearchInput } from '../../components/ui/FilterBar.jsx';
import { MockBadge, MockNotice } from '../../components/ui/MockNotice.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';
import { EmptyState } from '../../components/ui/Avatar.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { getMachines } from '../../services/api.js';
import { MACHINE_STATUS } from '../../lib/constants.js';

export default function ShopMachines() {
  const { user } = useAuth();
  const machines = useAsync(() => getMachines({ shopId: user?.shopId }), [user?.shopId]);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [qrMachine, setQrMachine] = useState(null);
  const [configMachine, setConfigMachine] = useState(null);

  const list = machines.data ?? [];
  const filtered = list.filter((machine) => {
    if (filter !== 'all' && machine.status !== filter) return false;
    if (query) {
      const haystack = `${machine.id} ${machine.name} ${machine.model}`.toLowerCase();
      if (!haystack.includes(query.toLowerCase())) return false;
    }
    return true;
  });

  const count = (status) => list.filter((m) => m.status === status).length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Machines"
        eyebrow="Fleet"
        description={
          <span className="flex flex-wrap items-center gap-2">
            Each printer has a unique machine ID, its own QR code and its own pricing. <MockBadge />
          </span>
        }
        actions={
          <>
            <Button
              variant="secondary"
              size="md"
              icon={RefreshCw}
              onClick={() => machines.refetch()}
            >
              Refresh
            </Button>
            <Button size="md" icon={Plus} to="/shop/subscription">
              Add machine
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total', value: list.length, tone: 'text-ink-900' },
          { label: 'Online', value: count('online'), tone: 'text-success' },
          { label: 'Printing', value: count('busy'), tone: 'text-brand-600' },
          {
            label: 'Offline / maint.',
            value: count('offline') + count('maintenance'),
            tone: 'text-warn',
          },
        ].map((item) => (
          <div key={item.label} className="card px-4 py-3.5">
            <p className="text-[11px] uppercase tracking-[0.06em] text-ink-400">{item.label}</p>
            <p
              className={`mt-1 text-[22px] font-semibold tabular-nums tracking-tight ${item.tone}`}
            >
              {item.value}
            </p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <FilterTabs
          tabs={[
            { value: 'all', label: 'All', count: list.length },
            { value: MACHINE_STATUS.ONLINE, label: 'Online', count: count('online') },
            { value: MACHINE_STATUS.BUSY, label: 'Printing', count: count('busy') },
            { value: MACHINE_STATUS.OFFLINE, label: 'Offline', count: count('offline') },
            {
              value: MACHINE_STATUS.MAINTENANCE,
              label: 'Maintenance',
              count: count('maintenance'),
            },
          ]}
          value={filter}
          onChange={setFilter}
        />
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search machine ID or model…"
          className="w-full sm:w-60"
        />
      </div>

      {machines.loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[260px] w-full rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={Search}
            title="No machines match"
            description="Adjust the filters, or register a new machine for this shop."
            action={
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setFilter('all');
                  setQuery('');
                }}
              >
                Clear filters
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((machine) => (
            <MachineCard
              key={machine.id}
              machine={machine}
              onQr={setQrMachine}
              onConfigure={setConfigMachine}
            />
          ))}
        </div>
      )}

      {/* Registering machines is an admin action */}
      <Card className="p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600">
              <QrCode className="size-4" />
            </span>
            <div>
              <h3 className="text-[14px] font-semibold text-ink-900">Register a new machine</h3>
              <p className="mt-0.5 max-w-lg text-[12.5px] leading-relaxed text-ink-500">
                Machine IDs are generated centrally by the platform to guarantee uniqueness across
                all shops. Registration is performed by a Super Admin, who then issues the QR code
                and pairs the local print agent.
              </p>
            </div>
          </div>
          <Button variant="secondary" size="sm" to="/admin/machines">
            Open admin registry
          </Button>
        </div>

        <div className="mt-4 grid gap-3 border-t border-line pt-4 sm:grid-cols-3">
          {[
            {
              icon: Cpu,
              title: '1 · Register',
              body: 'Admin creates the machine and links it to your shop ID.',
            },
            {
              icon: QrCode,
              title: '2 · Print the QR',
              body: 'Download the sticker and mount it on the printer.',
            },
            {
              icon: Printer,
              title: '3 · Pair the agent',
              body: 'The shop PC runs the agent with a pairing token.',
            },
          ].map((step) => (
            <div key={step.title} className="rounded-lg border border-line bg-surface-muted/40 p-3">
              <step.icon className="size-3.5 text-ink-400" />
              <p className="mt-1.5 text-[12px] font-medium text-ink-900">{step.title}</p>
              <p className="mt-0.5 text-[11.5px] leading-snug text-ink-500">{step.body}</p>
            </div>
          ))}
        </div>

        <MockNotice className="mt-4" tone="neutral">
          Browsers never talk to printers directly. The local Print Agent, installed on a shop
          computer, is the only component that sends jobs to the hardware.
        </MockNotice>
      </Card>

      <QrModal machine={qrMachine} open={Boolean(qrMachine)} onClose={() => setQrMachine(null)} />
      <MachineConfigModal
        machine={configMachine}
        open={Boolean(configMachine)}
        onClose={() => setConfigMachine(null)}
        onSaved={() => machines.refetch()}
      />
    </div>
  );
}
