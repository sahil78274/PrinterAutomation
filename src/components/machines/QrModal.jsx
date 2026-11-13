import { useState } from 'react';
import { Check, Copy, Download, ExternalLink, QrCode as QrIcon, Printer } from 'lucide-react';
import Modal, { ModalBody, ModalFooter, ModalHeader } from '../ui/Modal.jsx';
import Button from '../ui/Button.jsx';
import QrCode, { buildPrintUrl } from './QrCode.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { MockNotice } from '../ui/MockNotice.jsx';
import { downloadDataUrl } from '../../lib/utils.js';
import { MachineStatusBadge } from '../orders/OrderStatusBadge.jsx';

/**
 * QR code viewer + download.
 * The encoded URL always contains the machine ID, which is the single source of
 * truth for routing a customer to the right printer.
 */
export default function QrModal({ machine, open, onClose }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  if (!machine) return null;

  const url = buildPrintUrl(machine.id);
  const relative = `/print/${machine.id}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
      toast({ type: 'success', title: 'QR link copied', description: url });
    } catch {
      toast({
        type: 'error',
        title: 'Clipboard unavailable',
        description: 'Copy the URL manually.',
      });
    }
  };

  const download = () => {
    // Render a high-resolution PNG so the sticker prints cleanly.
    import('qrcode').then(({ default: QRCode }) => {
      const canvas = document.createElement('canvas');
      QRCode.toCanvas(canvas, url, { width: 900, margin: 1, errorCorrectionLevel: 'M' }, () => {
        downloadDataUrl(canvas.toDataURL('image/png'), `${machine.id}-qr.png`);
        toast({
          type: 'success',
          title: 'QR code downloaded',
          description: `${machine.id}-qr.png · 900px print-ready`,
        });
      });
    });
  };

  return (
    <Modal open={open} onClose={onClose} labelledBy="qr-modal-title">
      <ModalHeader
        id="qr-modal-title"
        title={`QR code · ${machine.id}`}
        description={`${machine.name} — ${machine.model}`}
        icon={QrIcon}
        onClose={onClose}
      />
      <ModalBody>
        <div className="flex flex-col items-center rounded-xl border border-line bg-surface-muted/50 p-5">
          <div className="rounded-xl bg-white p-3 shadow-card ring-1 ring-line">
            <QrCode value={url} size={188} />
          </div>
          <div className="mt-4 flex items-center gap-2">
            <span className="rounded-md bg-white px-2 py-1 font-mono text-[11.5px] font-medium text-ink-700 ring-1 ring-line">
              {relative}
            </span>
            <button
              type="button"
              onClick={copy}
              className="inline-flex items-center gap-1 rounded-md border border-line bg-white px-2 py-1 text-[11.5px] font-medium text-ink-600 transition-colors hover:bg-surface-muted"
            >
              {copied ? <Check className="size-3 text-success" /> : <Copy className="size-3" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <p className="mt-2.5 text-center text-[11px] leading-relaxed text-ink-400">
            Scanning opens the customer portal bound to this machine only.
          </p>
        </div>

        <dl className="mt-4 divide-y divide-line rounded-lg border border-line">
          <Row label="Machine ID" value={<span className="font-mono">{machine.id}</span>} />
          <Row label="Registered shop" value={machine.shopName} />
          <Row label="Status" value={<MachineStatusBadge status={machine.status} size="sm" />} />
          <Row
            label="Print agent"
            value={<span className="font-mono text-[11.5px]">{machine.agent.name}</span>}
          />
          <Row
            label="Printer"
            value={
              <span className="inline-flex items-center gap-1.5">
                <Printer className="size-3 text-ink-400" />
                {machine.model}
              </span>
            }
          />
        </dl>

        <MockNotice className="mt-4" tone="neutral" title="Printing instructions">
          Print this QR at least 40 × 40 mm, laminate it, and stick it on the machine&apos;s front
          panel near the paper tray. Re-download any time — the link never changes for a machine.
        </MockNotice>
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" size="sm" onClick={onClose}>
          Close
        </Button>
        <Button variant="secondary" size="sm" to={`/print/${machine.id}`} icon={ExternalLink}>
          Open portal
        </Button>
        <Button size="sm" onClick={download} icon={Download}>
          Download PNG
        </Button>
      </ModalFooter>
    </Modal>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
      <dt className="text-[11.5px] text-ink-500">{label}</dt>
      <dd className="min-w-0 truncate text-[12px] font-medium text-ink-900">{value}</dd>
    </div>
  );
}
