import { useEffect, useMemo, useState } from 'react';
import { Calculator, Info, Printer, Save, Tags } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Card, { CardHeader } from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import Input from '../../components/ui/Input.jsx';
import { MockBadge, MockNotice } from '../../components/ui/MockNotice.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';
import { MachineStatusBadge } from '../../components/orders/OrderStatusBadge.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { getMachines, updateMachinePricing } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { calculateQuote } from '../../lib/pricing.js';
import { cn, formatCurrency } from '../../lib/utils.js';

const FIELDS = [
  { key: 'bwSingle', label: 'B&W · single-sided', unit: '₹ / side', color: false },
  { key: 'bwDouble', label: 'B&W · double-sided', unit: '₹ / sheet', color: false },
  { key: 'colorSingle', label: 'Colour · single-sided', unit: '₹ / side', color: true },
  { key: 'colorDouble', label: 'Colour · double-sided', unit: '₹ / sheet', color: true },
];

export default function ShopPricing() {
  const { user } = useAuth();
  const { toast } = useToast();
  const machines = useAsync(() => getMachines({ shopId: user?.shopId }), [user?.shopId]);
  const list = useMemo(() => machines.data ?? [], [machines.data]);

  const [activeId, setActiveId] = useState(null);
  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState(false);

  const active = list.find((m) => m.id === activeId) ?? list[0] ?? null;

  useEffect(() => {
    if (active && !draft[active.id]) {
      setDraft((prev) => ({ ...prev, [active.id]: { ...active.pricing } }));
    }
    if (active && activeId !== active.id) setActiveId(active.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id]);

  const values = useMemo(() => draft[active?.id] ?? active?.pricing ?? {}, [draft, active]);
  const dirty = active
    ? Object.keys(values).some((key) => Number(values[key]) !== Number(active.pricing[key]))
    : false;

  const preview = useMemo(() => {
    if (!active) return null;
    const pricing = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, Number(v) || 0]));
    return {
      bw: calculateQuote({ pricing, pageCount: 10, copies: 1, color: false, sides: 'single' }),
      color: calculateQuote({ pricing, pageCount: 10, copies: 1, color: true, sides: 'single' }),
      duplex: calculateQuote({ pricing, pageCount: 10, copies: 1, color: false, sides: 'double' }),
    };
  }, [active, values]);

  const save = async () => {
    if (!active) return;
    setSaving(true);
    try {
      const patch = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, Number(v) || 0]));
      await updateMachinePricing(active.id, patch);
      toast({
        type: 'success',
        title: 'Rates saved',
        description: `${active.id} pricing updated. New orders use these rates immediately.`,
      });
      machines.refetch();
    } catch (error) {
      toast({ type: 'error', title: 'Could not save', description: error.message });
    } finally {
      setSaving(false);
    }
  };

  const setValue = (key, value) => {
    if (!active) return;
    setDraft((prev) => ({
      ...prev,
      [active.id]: { ...(prev[active.id] ?? active.pricing), [key]: value },
    }));
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Pricing management"
        eyebrow="Revenue"
        description={
          <span className="flex flex-wrap items-center gap-2">
            Set per-side rates for every machine. Customers see these prices before paying.{' '}
            <MockBadge />
          </span>
        }
        actions={
          <Button
            size="md"
            icon={Save}
            onClick={save}
            loading={saving}
            disabled={!dirty || !active}
          >
            {dirty ? 'Save changes' : 'Saved'}
          </Button>
        }
      />

      <MockNotice title="How per-side pricing works" tone="info" icon={Info}>
        Single-sided jobs are billed per printed page. Double-sided jobs are billed per sheet — one
        sheet carries two pages — so duplex is always cheaper than the same job printed
        single-sided. An A3 order applies a multiplier, and a minimum order value protects very
        small jobs.
      </MockNotice>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        {/* Machine selector */}
        <Card className="overflow-hidden">
          <CardHeader title="Machines" description="Select to edit rates" icon={Printer} />
          <div className="border-t border-line">
            {machines.loading
              ? [0, 1, 2].map((i) => (
                  <Skeleton key={i} className="m-3 h-12 w-[calc(100%-1.5rem)]" />
                ))
              : list.map((machine) => {
                  const isActive = active?.id === machine.id;
                  const changed = draft[machine.id]
                    ? Object.keys(draft[machine.id]).some(
                        (key) => Number(draft[machine.id][key]) !== Number(machine.pricing[key]),
                      )
                    : false;
                  return (
                    <button
                      key={machine.id}
                      onClick={() => setActiveId(machine.id)}
                      className={cn(
                        'flex w-full items-center gap-2.5 border-b border-line px-4 py-3 text-left transition-colors last:border-0',
                        isActive ? 'bg-brand-50/60' : 'hover:bg-surface-muted/60',
                      )}
                    >
                      <span
                        className={cn(
                          'grid size-7 shrink-0 place-items-center rounded-md',
                          isActive ? 'bg-brand-600 text-white' : 'bg-surface-sunken text-ink-500',
                        )}
                      >
                        <Printer className="size-3.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12.5px] font-medium text-ink-900">
                          {machine.name}
                        </span>
                        <span className="block font-mono text-[10.5px] text-ink-400">
                          {machine.id}
                        </span>
                      </span>
                      {changed ? (
                        <span
                          className="size-1.5 shrink-0 rounded-full bg-warn"
                          title="Unsaved changes"
                        />
                      ) : (
                        <MachineStatusBadge status={machine.status} size="sm" />
                      )}
                    </button>
                  );
                })}
          </div>
        </Card>

        {/* Editor */}
        {!active ? (
          <Card className="grid place-items-center p-10 text-center">
            <div>
              <Tags className="mx-auto size-6 text-ink-300" />
              <p className="mt-3 text-[13.5px] font-medium text-ink-900">No machines yet</p>
              <p className="mt-1 text-[12.5px] text-ink-500">
                Ask a Super Admin to register your first machine.
              </p>
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
            <Card>
              <CardHeader
                title={`${active.id} · ${active.name}`}
                description={`${active.model} · ${active.printer.supportsColor ? 'colour' : 'mono'} · ${active.printer.supportsDuplex ? 'duplex supported' : 'single-sided only'}`}
                icon={Calculator}
                action={<MachineStatusBadge status={active.status} size="sm" />}
              />
              <div className="grid gap-4 border-t border-line p-5 sm:grid-cols-2">
                {FIELDS.map((field) => {
                  const disabled = field.color && !active.printer.supportsColor;
                  return (
                    <Input
                      key={field.key}
                      label={field.label}
                      type="number"
                      min={0}
                      step="0.5"
                      disabled={disabled}
                      hint={disabled ? 'Not supported by this printer' : field.unit}
                      value={values[field.key] ?? ''}
                      onChange={(e) => setValue(field.key, e.target.value)}
                    />
                  );
                })}
                <Input
                  label="A3 surcharge multiplier"
                  type="number"
                  min={1}
                  step="0.1"
                  hint="Applies only to machines that support A3"
                  value={values.a3Surcharge ?? ''}
                  onChange={(e) => setValue('a3Surcharge', e.target.value)}
                />
                <Input
                  label="Minimum order value (₹)"
                  type="number"
                  min={0}
                  hint="Small orders are topped up to this amount"
                  value={values.minimumCharge ?? ''}
                  onChange={(e) => setValue('minimumCharge', e.target.value)}
                />
              </div>
            </Card>

            <Card>
              <CardHeader
                title="Live customer preview"
                description="Exactly what a customer sees for a 10-page document"
              />
              <div className="grid gap-3 px-5 pb-5 sm:grid-cols-3">
                {[
                  { label: 'B&W single-sided', quote: preview?.bw },
                  { label: 'B&W double-sided', quote: preview?.duplex },
                  {
                    label: active.printer.supportsColor
                      ? 'Colour single-sided'
                      : 'Colour (unsupported)',
                    quote: preview?.color,
                    disabled: !active.printer.supportsColor,
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className={cn(
                      'rounded-lg border border-line p-3.5',
                      item.disabled && 'opacity-40',
                    )}
                  >
                    <p className="text-[11px] text-ink-500">{item.label}</p>
                    <p className="mt-1 text-[20px] font-semibold tabular-nums tracking-tight text-ink-900">
                      {formatCurrency(item.quote?.total ?? 0, { decimals: 0 })}
                    </p>
                    <p className="mt-0.5 text-[10.5px] text-ink-400">
                      {item.quote?.pages} pages · {item.quote?.sheetsUsed} sheet
                      {item.quote?.sheetsUsed === 1 ? '' : 's'} billed
                    </p>
                  </div>
                ))}
              </div>
            </Card>

            <MockNotice tone="neutral" title="Per-machine overrides">
              Rates are stored per machine, not per shop. Two printers in the same shop can charge
              different rates — useful when one is a faster colour device with a higher cost per
              page.
            </MockNotice>
          </div>
        )}
      </div>
    </div>
  );
}
