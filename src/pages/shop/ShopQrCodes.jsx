import { useState } from 'react';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Card from '../../components/ui/Card.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import Modal from '../../components/ui/Modal.jsx';
import { db } from '../../services/db.js';
import { useToast } from '../../context/ToastContext.jsx';

export default function ShopQrCodes() {
  const [selectedMachine, setSelectedMachine] = useState(null);
  const toast = useToast();
  const shop = db.shops[0];
  const machines = db.machines.filter((m) => m.shopId === shop?.id);

  const handleDownload = (machine) => {
    toast.success(`QR code for ${machine.machineId || machine.id} ready for download`);
    setSelectedMachine(null);
  };

  const handlePrint = (machine) => {
    toast.success(`Opening print dialog for ${machine.machineId || machine.id} QR code`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="QR codes"
        description="Manage and download QR codes for your machines. Place these at each printing machine for customers to scan."
      />

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-line text-[11px] uppercase tracking-wider text-ink-400">
                <th className="pb-3 pr-4 font-medium">Machine</th>
                <th className="pb-3 pr-4 font-medium">Machine ID</th>
                <th className="pb-3 pr-4 font-medium">QR URL</th>
                <th className="pb-3 pr-4 font-medium">Status</th>
                <th className="pb-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {machines.map((machine) => {
                const machineId = machine.machineId || machine.id;
                const qrUrl = `${window.location.origin}/print/${machineId}`;
                return (
                  <tr key={machine.id || machineId}>
                    <td className="py-3 pr-4 font-medium text-ink-900">{machine.name || machineId}</td>
                    <td className="py-3 pr-4 text-ink-600 font-mono text-[12px]">{machineId}</td>
                    <td className="py-3 pr-4 text-ink-500 text-[12px] truncate max-w-[200px]">{qrUrl}</td>
                    <td className="py-3 pr-4">
                      <Badge tone={machine.status === 'online' ? 'success' : 'neutral'}>
                        {machine.status || 'active'}
                      </Badge>
                    </td>
                    <td className="py-3">
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setSelectedMachine({ ...machine, qrUrl, machineId })}>
                          View QR
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDownload(machine)}>
                          Download
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {machines.length === 0 && (
          <div className="py-12 text-center text-[13px] text-ink-400">
            No machines registered yet. Add a machine first to generate QR codes.
          </div>
        )}
      </Card>

      {selectedMachine && (
        <Modal open={!!selectedMachine} onClose={() => setSelectedMachine(null)} title={`QR Code — ${selectedMachine.machineId}`}>
          <div className="space-y-4">
            <div className="flex items-center justify-center rounded-lg border-2 border-dashed border-line bg-surface-muted p-8">
              <div className="text-center">
                <div className="mx-auto flex h-32 w-32 items-center justify-center rounded-lg bg-white border border-line">
                  <div className="text-[14px] text-ink-400 font-mono">{selectedMachine.machineId}</div>
                </div>
                <p className="mt-3 text-[12px] text-ink-500">QR Code placeholder</p>
              </div>
            </div>
            <div className="rounded-md bg-surface-muted p-3">
              <p className="text-[12px] text-ink-500 mb-1">Scan URL:</p>
              <p className="text-[13px] font-mono text-ink-700 break-all">{selectedMachine.qrUrl}</p>
            </div>
            <div className="flex gap-3 justify-end">
              <Button variant="ghost" onClick={() => handlePrint(selectedMachine)}>Print QR</Button>
              <Button onClick={() => handleDownload(selectedMachine)}>Download PNG</Button>
            </div>
          </div>
        </Modal>
      )}

      <Card>
        <h3 className="text-[14px] font-semibold text-ink-900 mb-3">QR code placement guide</h3>
        <ul className="space-y-2 text-[13px] text-ink-600">
          <li className="flex gap-2">
            <span className="text-brand-500 mt-0.5">1.</span>
            Print the QR code on A4 paper or adhesive sticker at a minimum size of 5cm x 5cm.
          </li>
          <li className="flex gap-2">
            <span className="text-brand-500 mt-0.5">2.</span>
            Place the QR code at eye level near the printer, clearly visible to customers.
          </li>
          <li className="flex gap-2">
            <span className="text-brand-500 mt-0.5">3.</span>
            Include a brief instruction: Scan to print — upload PDF, choose options, pay, collect.
          </li>
          <li className="flex gap-2">
            <span className="text-brand-500 mt-0.5">4.</span>
            Ensure good lighting so the QR code is easy to scan with any smartphone camera.
          </li>
          <li className="flex gap-2">
            <span className="text-brand-500 mt-0.5">5.</span>
            Each QR code is unique to its machine — do not copy the same code to multiple printers.
          </li>
        </ul>
      </Card>
    </div>
  );
}
