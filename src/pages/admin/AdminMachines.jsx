import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  Download,
  Fingerprint,
  Plus,
  Printer,
  QrCode,
  RefreshCw,
  Rss,
} from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import Modal, { ModalBody, ModalFooter, ModalHeader } from '../../components/ui/Modal.jsx';
import Input, { Select, Switch } from '../../components/ui/Input.jsx';
import { MachineStatusBadge } from '../../components/orders/OrderStatusBadge.jsx';
import QrModal from '../../components/machines/QrModal.jsx';
import QrCodeImage, { buildPrintUrl } from '../../components/machines/QrCode.jsx';
import { FilterSelect, FilterTabs, SearchInput } from '../../components/ui/FilterBar.jsx';
import { MockBadge, MockNotice } from '../../components/ui/MockNotice.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { createMachine, getMachines, getShops } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { MACHINE_STATUS } from '../../lib/constants.js';
import { downloadDataUrl, formatCurrency, timeAgo } from '../../lib/utils.js';

const PRINTER_MODELS = [
  'HP LaserJet Pro M404dn',
  'Canon imageRUNNER 2630i',
  'Ricoh IM C3010',
  'Xerox VersaLink C405',
  'Brother HL-L2351DW',
  'Konica Minolta bizhub C300i',
  'Epson EcoTank L3252',
  'Canon iR-ADV DX C3830i',
];

export default function AdminMachines() {
  const machines = useAsync(() => getMachines(), []);
  const shops = useAsync(() => getShops(), []);

  const [filter, setFilter] = useState('all');
  const [shopFilter, setShopFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [qrMachine, setQrMachine] = useState(null);
  const [registerOpen, setRegisterOpen] = useState(false);

  const list = useMemo(() => machines.data ?? [], [machines.data]);
  const filtered = useMemo(
    () =>
      list.filter((machine) => {
        if (filter !== 'all' && machine.status !== filter) return false;
        if (shopFilter !== 'all' && machine.shopId !== shopFilter) return false;
        if (query) {
          const haystack =
            `${machine.id} ${machine.name} ${machine.model} ${machine.shopName}`.toLowerCase();
          if (!haystack.includes(query.toLowerCase())) return false;
        }
        return true;
      }),
    [list, filter, shopFilter, query],
  );

  const columns = [
    {
      key: 'id',
      header: 'Machine ID',
      render: (row) => (
        <div className="flex items-center gap-2">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-sunken text-ink-500">
            <Printer className="size-3.5" />
          </span>
          <div>
            <Link
              to={`/admin/machines/${row.id}`}
              className="font-mono text-[12px] font-semibold text-ink-900 hover:text-brand-600"
            >
              {row.id}
            </Link>
            <p className="text-[10.5px] text-ink-400">{row.serial}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'shop',
      header: 'Registered shop',
      hideBelow: 'sm',
      render: (row) => (
        <div className="max-w-[180px]">
          <p className="truncate text-[12.5px] text-ink-800">{row.shopName}</p>
          <p className="font-mono text-[10.5px] text-ink-400">{row.shopId}</p>
        </div>
      ),
    },
    {
      key: 'model',
      header: 'Printer',
      hideBelow: 'lg',
      render: (row) => (
        <div>
          <p className="text-[12.5px] text-ink-700">{row.name}</p>
          <p className="max-w-[170px] truncate text-[11px] text-ink-400">{row.model}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <MachineStatusBadge status={row.status} size="sm" />,
    },
    {
      key: 'agent',
      header: 'Print agent',
      hideBelow: 'xl',
      render: (row) => (
        <div>
          <p className="inline-flex items-center gap-1 font-mono text-[11px] text-ink-700">
            <Rss
              className={`size-2.5 ${row.agent.status === 'connected' ? 'text-success' : 'text-danger'}`}
            />
            {row.agent.name}
          </p>
          <p className="text-[10.5px] text-ink-400">
            {row.lastHeartbeat ? timeAgo(row.lastHeartbeat) : 'never paired'}
          </p>
        </div>
      ),
    },
    {
      key: 'revenue',
      header: 'Revenue',
      align: 'right',
      hideBelow: 'md',
      render: (row) => (
        <div>
          <p className="tabular-nums text-[12.5px] font-medium text-ink-900">
            {formatCurrency(row.lifetimeRevenue, { compact: true })}
          </p>
          <p className="text-[10.5px] text-ink-400">{row.jobsToday} jobs today</p>
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setQrMachine(row);
            }}
            className="rounded-md p-1.5 text-ink-400 transition-colors hover:bg-surface-sunken hover:text-ink-800"
            aria-label={`QR code for ${row.id}`}
            title="QR code"
          >
            <QrCode className="size-3.5" />
          </button>
          <Link
            to={`/admin/machines/${row.id}`}
            onClick={(e) => e.stopPropagation()}
            className="rounded-md p-1.5 text-ink-400 transition-colors hover:bg-surface-sunken hover:text-ink-800"
            aria-label={`Open ${row.id}`}
            title="Details"
          >
            <ArrowUpRight className="size-3.5" />
          </Link>
        </div>
      ),
    },
  ];

  const count = (status) => list.filter((m) => m.status === status).length;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Registry"
        title="Machine registration"
        description={
          <span className="flex flex-wrap items-center gap-2">
            Machine IDs are issued centrally and are unique across every shop on the platform.{' '}
            <MockBadge />
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
            <Button size="md" icon={Plus} onClick={() => setRegisterOpen(true)}>
              Register machine
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total machines', value: list.length, tone: 'text-ink-900' },
          { label: 'Online', value: count('online') + count('busy'), tone: 'text-success' },
          { label: 'Offline', value: count('offline'), tone: 'text-ink-500' },
          { label: 'Maintenance', value: count('maintenance'), tone: 'text-warn' },
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

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="Search ID, model or shop…"
              className="w-full sm:w-64"
            />
            <FilterSelect
              value={shopFilter}
              onChange={setShopFilter}
              label="Filter by shop"
              options={[
                { value: 'all', label: 'All shops' },
                ...(shops.data ?? []).map((s) => ({ value: s.id, label: s.name })),
              ]}
              className="w-full sm:w-48"
            />
            <span className="ml-auto hidden text-[12px] text-ink-400 sm:block">
              {filtered.length} machine{filtered.length === 1 ? '' : 's'}
            </span>
          </div>
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
        </div>

        <DataTable columns={columns} rows={filtered} loading={machines.loading} />
      </Card>

      <MockNotice tone="info" title="How machine IDs are issued">
        On registration the platform reserves the next free numeric ID (SP-001, SP-002, …) and binds
        it to a shop. The QR URL is <span className="font-mono">/print/&lt;machine-id&gt;</span>, so
        a scan is always resolved server-side to the correct shop and printer.
      </MockNotice>

      <QrModal machine={qrMachine} open={Boolean(qrMachine)} onClose={() => setQrMachine(null)} />
      <RegisterMachineModal
        open={registerOpen}
        onClose={() => setRegisterOpen(false)}
        shops={shops.data ?? []}
        onCreated={() => {
          machines.refetch();
          shops.refetch();
        }}
      />
    </div>
  );
}

function RegisterMachineModal({ open, onClose, shops, onCreated }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    shopId: shops[0]?.id ?? '',
    name: '',
    model: PRINTER_MODELS[0],
    supportsColor: false,
    supportsDuplex: true,
  });
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState(null);

  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));
  const setBool = (key) => (value) => setForm((prev) => ({ ...prev, [key]: value }));

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const machine = await createMachine({
        shopId: form.shopId,
        name: form.name || 'Main counter',
        model: form.model,
        supportsColor: form.supportsColor,
        supportsDuplex: form.supportsDuplex,
      });
      setCreated(machine);
      onCreated?.();
      toast({
        type: 'success',
        title: `Machine ${machine.id} registered`,
        description: 'QR code is ready to download.',
      });
    } catch (error) {
      toast({ type: 'error', title: 'Registration failed', description: error.message });
    } finally {
      setSaving(false);
    }
  };

  const close = () => {
    setCreated(null);
    setForm((prev) => ({ ...prev, name: '' }));
    onClose();
  };

  const downloadQr = () => {
    if (!created) return;
    import('qrcode').then(({ default: QRCode }) => {
      const canvas = document.createElement('canvas');
      QRCode.toCanvas(canvas, buildPrintUrl(created.id), { width: 900, margin: 1 }, () => {
        downloadDataUrl(canvas.toDataURL('image/png'), `${created.id}-qr.png`);
        toast({ type: 'success', title: 'QR downloaded', description: `${created.id}-qr.png` });
      });
    });
  };

  return (
    <Modal open={open} onClose={close} labelledBy="register-machine-title">
      <ModalHeader
        id="register-machine-title"
        title={created ? `Machine ${created.id} created` : 'Register a new machine'}
        description={
          created
            ? 'Print and mount the QR sticker on the printer.'
            : 'Issues a unique machine ID and QR URL automatically.'
        }
        icon={created ? QrCode : Fingerprint}
        onClose={close}
      />

      {created ? (
        <>
          <ModalBody>
            <div className="flex flex-col items-center rounded-xl border border-line bg-surface-muted/50 p-5">
              <div className="rounded-xl bg-white p-3 shadow-card ring-1 ring-line">
                <QrCodeImage value={buildPrintUrl(created.id)} size={172} />
              </div>
              <p className="mt-3 font-mono text-[13px] font-semibold text-ink-900">{created.id}</p>
              <p className="mt-0.5 font-mono text-[11px] text-ink-500">/print/{created.id}</p>
            </div>

            <dl className="mt-4 divide-y divide-line rounded-lg border border-line text-[12px]">
              {[
                ['Shop', created.shopName],
                ['Machine name', created.name],
                ['Printer model', created.model],
                [
                  'Colour / duplex',
                  `${created.printer.supportsColor ? 'Colour' : 'Mono'} · ${created.printer.supportsDuplex ? 'Duplex' : 'Single-sided'}`,
                ],
                ['Agent', created.agent.name],
                ['Status', 'Offline until the agent pairs'],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3 px-3.5 py-2.5">
                  <dt className="text-ink-500">{label}</dt>
                  <dd className="min-w-0 truncate text-right font-medium text-ink-900">{value}</dd>
                </div>
              ))}
            </dl>

            <MockNotice className="mt-4" tone="neutral">
              The machine stays offline until a local Print Agent pairs using its machine ID and
              pairing token. Registration alone does not enable printing.
            </MockNotice>
          </ModalBody>
          <ModalFooter>
            <Button variant="secondary" size="sm" onClick={close}>
              Done
            </Button>
            <Button size="sm" icon={Download} onClick={downloadQr}>
              Download QR
            </Button>
          </ModalFooter>
        </>
      ) : (
        <form onSubmit={submit}>
          <ModalBody className="space-y-4">
            <Select label="Assign to shop" value={form.shopId} onChange={set('shopId')} required>
              {shops.map((shop) => (
                <option key={shop.id} value={shop.id}>
                  {shop.name} ({shop.id})
                </option>
              ))}
            </Select>
            <Input
              label="Machine name"
              placeholder="e.g. Counter A"
              value={form.name}
              onChange={set('name')}
              hint="How staff identify this printer"
              required
            />
            <Select label="Printer model" value={form.model} onChange={set('model')}>
              {PRINTER_MODELS.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </Select>

            <div className="rounded-lg border border-line px-3.5">
              <Switch
                label="Supports colour printing"
                description="Enables colour rates in the customer portal"
                checked={form.supportsColor}
                onChange={setBool('supportsColor')}
              />
              <div className="h-px bg-line" />
              <Switch
                label="Supports duplex (double-sided)"
                description="Allows double-sided jobs on this machine"
                checked={form.supportsDuplex}
                onChange={setBool('supportsDuplex')}
              />
            </div>

            <MockNotice tone="info" icon={Fingerprint}>
              The next available machine ID is reserved server-side on submit — clients never choose
              or reuse IDs.
            </MockNotice>
          </ModalBody>
          <ModalFooter>
            <Button type="button" variant="secondary" size="sm" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" size="sm" loading={saving} icon={Plus}>
              Register &amp; generate QR
            </Button>
          </ModalFooter>
        </form>
      )}
    </Modal>
  );
}
