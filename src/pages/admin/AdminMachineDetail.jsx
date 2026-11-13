import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  Copy,
  Cpu,
  Download,
  ExternalLink,
  FileText,
  Printer,
  QrCode,
  Rss,
  Settings2,
  ShieldCheck,
  Wifi,
} from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Card, { CardHeader } from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import Badge from '../../components/ui/Badge.jsx';
import { MachineStatusBadge, OrderStatusBadge } from '../../components/orders/OrderStatusBadge.jsx';
import { LevelBar } from '../../components/charts/ProgressBar.jsx';
import QrCodeImage, { buildPrintUrl } from '../../components/machines/QrCode.jsx';
import MachineConfigModal from '../../components/shop/MachineConfigModal.jsx';
import { MockBadge, MockNotice } from '../../components/ui/MockNotice.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';
import { EmptyState } from '../../components/ui/Avatar.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { getMachine, getOrders } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import {
  downloadDataUrl,
  formatCurrency,
  formatDate,
  formatDateTime,
  timeAgo,
} from '../../lib/utils.js';

export default function AdminMachineDetail() {
  const { machineId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const machine = useAsync(() => getMachine(machineId), [machineId]);
  const orders = useAsync(() => getOrders({ machineId, limit: 10 }), [machineId]);
  const [configOpen, setConfigOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const data = machine.data;

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(buildPrintUrl(data.id));
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
      toast({ type: 'success', title: 'QR URL copied' });
    } catch {
      toast({ type: 'error', title: 'Clipboard unavailable' });
    }
  };

  const downloadQr = () => {
    import('qrcode').then(({ default: QRCode }) => {
      const canvas = document.createElement('canvas');
      QRCode.toCanvas(canvas, buildPrintUrl(data.id), { width: 900, margin: 1 }, () => {
        downloadDataUrl(canvas.toDataURL('image/png'), `${data.id}-qr.png`);
        toast({ type: 'success', title: 'QR downloaded', description: '900px print-ready PNG' });
      });
    });
  };

  if (machine.loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!data) {
    return (
      <Card>
        <EmptyState
          icon={Printer}
          title="Machine not found"
          description={`No machine with ID ${machineId} is registered.`}
          action={<Button to="/admin/machines">Back to registry</Button>}
        />
      </Card>
    );
  }

  const jobColumns = [
    {
      key: 'id',
      header: 'Order',
      render: (row) => (
        <div>
          <p className="font-mono text-[12px] font-medium text-ink-900">{row.id}</p>
          <p className="text-[10.5px] text-ink-400">{formatDateTime(row.createdAt)}</p>
        </div>
      ),
    },
    {
      key: 'doc',
      header: 'Document',
      hideBelow: 'sm',
      render: (row) => (
        <div className="max-w-[190px]">
          <p className="truncate text-[12px] text-ink-700">{row.documents?.[0]?.name ?? '—'}</p>
          <p className="text-[10.5px] text-ink-400">
            {row.pageCount} pages · {row.copies}× · {row.color ? 'Colour' : 'B&W'}
          </p>
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      render: (row) => (
        <span className="tabular-nums text-[12.5px] text-ink-900">
          {formatCurrency(row.amount)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <OrderStatusBadge status={row.status} size="sm" />,
    },
  ];

  return (
    <div className="space-y-5">
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-500 transition-colors hover:text-ink-900"
      >
        <ArrowLeft className="size-3.5" />
        Back to registry
      </button>

      <PageHeader
        eyebrow={`Machine · ${data.id}`}
        title={`${data.name} — ${data.shopName}`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span>{data.model}</span>
            <span className="text-ink-300">·</span>
            <span className="font-mono text-[11.5px] text-ink-400">{data.serial}</span>
            <MockBadge />
          </span>
        }
        actions={
          <>
            <Button
              variant="secondary"
              size="md"
              icon={Settings2}
              onClick={() => setConfigOpen(true)}
            >
              Pricing
            </Button>
            <Button variant="secondary" size="md" icon={ExternalLink} to={`/print/${data.id}`}>
              Open portal
            </Button>
            <Button size="md" icon={Download} onClick={downloadQr}>
              Download QR
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Machine identity"
              description="Central registry record"
              icon={Cpu}
              action={<MachineStatusBadge status={data.status} size="sm" />}
            />
            <dl className="grid gap-x-6 gap-y-3.5 border-t border-line p-5 text-[12.5px] sm:grid-cols-2">
              {[
                [
                  'Machine ID',
                  <span key="id" className="font-mono font-semibold">
                    {data.id}
                  </span>,
                ],
                [
                  'Registered shop',
                  <Link key="shop" to="/admin/shops" className="text-brand-600 hover:underline">
                    {data.shopName}
                  </Link>,
                ],
                [
                  'Shop ID',
                  <span key="sid" className="font-mono text-[11.5px]">
                    {data.shopId}
                  </span>,
                ],
                [
                  'Serial number',
                  <span key="sn" className="font-mono text-[11.5px]">
                    {data.serial}
                  </span>,
                ],
                ['Registered on', formatDate(data.registeredOn)],
                ['Last heartbeat', data.lastHeartbeat ? timeAgo(data.lastHeartbeat) : 'never'],
                [
                  'QR URL',
                  <span key="qr" className="font-mono text-[11.5px] text-brand-700">
                    /print/{data.id}
                  </span>,
                ],
                ['Lifetime jobs', data.totalJobs.toLocaleString('en-IN')],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-[10.5px] uppercase tracking-[0.06em] text-ink-400">
                    {label}
                  </dt>
                  <dd className="mt-0.5 truncate font-medium text-ink-900">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader title="Printer configuration" icon={Printer} />
              <dl className="space-y-2 px-5 pb-5 text-[12px]">
                <Row label="Model" value={data.printer.model} />
                <Row label="Connection" value={data.printer.connection} />
                <Row
                  label="Colour"
                  value={data.printer.supportsColor ? 'Supported' : 'Mono only'}
                />
                <Row
                  label="Duplex"
                  value={data.printer.supportsDuplex ? 'Supported' : 'Single-sided'}
                />
                <Row label="Max paper" value={data.printer.maxPaperSize} />
                <Row label="Trays" value={data.printer.paperTrays.join(', ')} />
              </dl>
            </Card>

            <Card>
              <CardHeader
                title="Print agent"
                icon={Rss}
                action={
                  <Badge
                    tone={data.agent.status === 'connected' ? 'success' : 'danger'}
                    size="sm"
                    dot
                  >
                    {data.agent.status}
                  </Badge>
                }
              />
              <dl className="space-y-2 px-5 pb-5 text-[12px]">
                <Row
                  label="Agent name"
                  value={<span className="font-mono text-[11px]">{data.agent.name}</span>}
                />
                <Row label="Version" value={data.agent.version} />
                <Row label="Host OS" value={data.agent.os} />
                <Row label="Queue" value={`${data.agent.queuedJobs} job(s)`} />
                <Row label="Auto-start" value={data.agent.autoStart ? 'Enabled' : 'Disabled'} />
                <Row
                  label="Last seen"
                  value={data.agent.lastSeen ? timeAgo(data.agent.lastSeen) : '—'}
                />
              </dl>
            </Card>
          </div>

          <Card>
            <CardHeader title="Consumables" description="Reported by the print agent" />
            <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2">
              <LevelBar label="Paper" value={data.paperLevel} />
              <LevelBar label="Toner" value={data.tonerLevel} />
            </div>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader title="Recent jobs on this machine" icon={FileText} />
            <DataTable columns={jobColumns} rows={orders.data ?? []} loading={orders.loading} />
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex items-center gap-2">
              <QrCode className="size-4 text-brand-600" />
              <h3 className="text-[13.5px] font-semibold text-ink-900">Machine QR code</h3>
            </div>
            <div className="mt-4 flex flex-col items-center rounded-xl border border-line bg-surface-muted/50 p-4">
              <div className="rounded-lg bg-white p-2.5 shadow-card ring-1 ring-line">
                <QrCodeImage value={buildPrintUrl(data.id)} size={164} />
              </div>
              <p className="mt-3 font-mono text-[12px] font-medium text-ink-900">
                /print/{data.id}
              </p>
              <button
                type="button"
                onClick={copyUrl}
                className="mt-2 inline-flex items-center gap-1 rounded-md border border-line bg-white px-2 py-1 text-[11px] font-medium text-ink-600 transition-colors hover:bg-surface-muted"
              >
                {copied ? <Check className="size-3 text-success" /> : <Copy className="size-3" />}
                {copied ? 'Copied' : 'Copy full URL'}
              </button>
            </div>
            <Button className="mt-3 w-full" size="sm" icon={Download} onClick={downloadQr}>
              Download print-ready PNG
            </Button>
            <p className="mt-2 text-center text-[10.5px] leading-relaxed text-ink-400">
              Print at 40 × 40 mm or larger. The encoded URL is permanent for this machine.
            </p>
          </Card>

          <Card>
            <CardHeader title="Current pricing" description="Per printed side" icon={Settings2} />
            <dl className="space-y-2 px-5 pb-5 text-[12px]">
              <Row label="B&W single" value={`₹${data.pricing.bwSingle}`} />
              <Row label="B&W double" value={`₹${data.pricing.bwDouble}`} />
              <Row
                label="Colour single"
                value={data.printer.supportsColor ? `₹${data.pricing.colorSingle}` : 'n/a'}
              />
              <Row
                label="Colour double"
                value={data.printer.supportsColor ? `₹${data.pricing.colorDouble}` : 'n/a'}
              />
              <Row label="A3 multiplier" value={`×${data.pricing.a3Surcharge}`} />
              <Row label="Minimum order" value={`₹${data.pricing.minimumCharge}`} />
            </dl>
            <div className="px-5 pb-5">
              <Button
                variant="secondary"
                size="sm"
                className="w-full"
                onClick={() => setConfigOpen(true)}
              >
                Edit pricing
              </Button>
            </div>
          </Card>

          <MockNotice tone="neutral" icon={ShieldCheck} title="Hardware stays local">
            The platform never sends a job directly to the printer. It only issues jobs to the
            paired agent, which owns the driver configuration and paper trays.
          </MockNotice>

          <div className="rounded-xl border border-line bg-white p-4">
            <div className="flex items-center gap-2">
              <Wifi className="size-3.5 text-ink-400" />
              <p className="text-[11.5px] font-medium text-ink-800">Heartbeat contract</p>
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-ink-500">
              Agent posts <span className="font-mono">/api/agents/:id/heartbeat</span> every 30s
              with status, paper level and queue depth. Missing 3 beats marks the machine offline.
            </p>
          </div>
        </div>
      </div>

      <MachineConfigModal
        machine={data}
        open={configOpen}
        onClose={() => setConfigOpen(false)}
        onSaved={() => machine.refetch()}
      />
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-ink-500">{label}</span>
      <span className="min-w-0 truncate text-right font-medium text-ink-900">{value}</span>
    </div>
  );
}
