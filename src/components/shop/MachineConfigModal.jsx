import { useEffect, useState } from 'react';
import { Settings2, Zap } from 'lucide-react';
import Modal, { ModalBody, ModalFooter, ModalHeader } from '../ui/Modal.jsx';
import Button from '../ui/Button.jsx';
import Input from '../ui/Input.jsx';
import { MockNotice } from '../ui/MockNotice.jsx';
import { updateMachinePricing, sendAgentCommand } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';

const PRICE_FIELDS = [
  { key: 'bwSingle', label: 'B&W · single-sided', suffix: '₹ / printed side' },
  { key: 'bwDouble', label: 'B&W · double-sided', suffix: '₹ / duplex sheet' },
  { key: 'colorSingle', label: 'Colour · single-sided', suffix: '₹ / printed side' },
  { key: 'colorDouble', label: 'Colour · double-sided', suffix: '₹ / duplex sheet' },
  { key: 'minimumCharge', label: 'Minimum order value', suffix: '₹' },
];

export default function MachineConfigModal({ machine, open, onClose, onSaved }) {
  const { toast } = useToast();
  const [pricing, setPricing] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (machine) setPricing({ ...machine.pricing });
  }, [machine]);

  if (!machine) return null;

  const supportsColor = machine.printer.supportsColor;

  const save = async () => {
    setSaving(true);
    try {
      const patch = {};
      Object.keys(pricing).forEach((key) => {
        const value = Number(pricing[key]);
        if (!Number.isNaN(value)) patch[key] = value;
      });
      await updateMachinePricing(machine.id, patch);
      toast({
        type: 'success',
        title: 'Pricing updated',
        description: `New rates apply to ${machine.id} from the next order.`,
      });
      onSaved?.();
      onClose();
    } catch (error) {
      toast({ type: 'error', title: 'Could not save', description: error.message });
    } finally {
      setSaving(false);
    }
  };

  const pingAgent = async () => {
    try {
      await sendAgentCommand(machine.id, 'ping');
      toast({
        type: 'info',
        title: 'Agent command simulated',
        description: `Ping sent to ${machine.agent.name}. No real hardware was contacted.`,
      });
    } catch (error) {
      toast({ type: 'error', title: 'Command failed', description: error.message });
    }
  };

  return (
    <Modal open={open} onClose={onClose} labelledBy="config-modal-title">
      <ModalHeader
        id="config-modal-title"
        title={`Configure ${machine.id}`}
        description={`${machine.name} · ${machine.model}`}
        icon={Settings2}
        onClose={onClose}
      />
      <ModalBody className="space-y-4">
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-400">
            Per-side pricing
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {PRICE_FIELDS.map((field) => {
              const disabled =
                !supportsColor && (field.key === 'colorSingle' || field.key === 'colorDouble');
              return (
                <Input
                  key={field.key}
                  label={field.label}
                  type="number"
                  min={0}
                  step="0.5"
                  disabled={disabled}
                  hint={disabled ? 'Machine is B&W only' : field.suffix}
                  value={pricing[field.key] ?? ''}
                  onChange={(e) => setPricing((prev) => ({ ...prev, [field.key]: e.target.value }))}
                />
              );
            })}
          </div>
        </div>

        <div className="rounded-lg border border-line bg-surface-muted/50 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-400">
            Agent connection
          </p>
          <dl className="mt-2 space-y-1.5 text-[12px]">
            <div className="flex justify-between">
              <dt className="text-ink-500">Agent</dt>
              <dd className="font-mono text-ink-800">{machine.agent.name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-500">Status</dt>
              <dd className="font-medium text-ink-800">{machine.agent.status}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-500">Version</dt>
              <dd className="text-ink-800">{machine.agent.version}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-500">Queue</dt>
              <dd className="text-ink-800">{machine.agent.queuedJobs} job(s)</dd>
            </div>
          </dl>
          <Button
            variant="secondary"
            size="sm"
            className="mt-3 w-full"
            icon={Zap}
            onClick={pingAgent}
          >
            Send test ping to agent
          </Button>
        </div>

        <MockNotice tone="neutral">
          Printer configuration (drivers, tray mapping, duplex support) lives in the local Print
          Agent, not the browser. This dialog edits platform-side pricing only.
        </MockNotice>
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button size="sm" onClick={save} loading={saving}>
          Save changes
        </Button>
      </ModalFooter>
    </Modal>
  );
}
