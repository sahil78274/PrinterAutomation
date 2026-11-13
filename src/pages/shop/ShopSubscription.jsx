import { useState } from 'react';
import { Check, CreditCard, Download, Gauge, Receipt, Sparkles, TriangleAlert } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Card, { CardHeader } from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import Badge from '../../components/ui/Badge.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import { ProgressBar } from '../../components/charts/ProgressBar.jsx';
import { MockBadge, MockNotice } from '../../components/ui/MockNotice.jsx';
import { PLAN_CATALOG } from '../../lib/constants.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { changePlan, getInvoices, getMachines, getShops } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { cn, formatCurrency, formatDate } from '../../lib/utils.js';

export default function ShopSubscription() {
  const { user } = useAuth();
  const { toast } = useToast();
  const shops = useAsync(() => getShops(), []);
  const machines = useAsync(() => getMachines({ shopId: user?.shopId }), [user?.shopId]);
  const invoices = useAsync(() => getInvoices(user?.shopId), [user?.shopId]);
  const [changing, setChanging] = useState(null);

  const shop = shops.data?.find((s) => s.id === user?.shopId);
  const plan = PLAN_CATALOG.find((p) => p.id === shop?.planId) ?? PLAN_CATALOG[0];
  const machineCount = (machines.data ?? []).length;
  const machineUsage = Math.min(100, Math.round((machineCount / plan.limits.machines) * 100));

  const selectPlan = async (planId) => {
    if (planId === shop?.planId) return;
    setChanging(planId);
    try {
      await changePlan(shop.id, planId);
      toast({
        type: 'success',
        title: 'Plan change simulated',
        description: `Now on ${PLAN_CATALOG.find((p) => p.id === planId)?.name}. No billing was triggered.`,
      });
      shops.refetch();
    } catch (error) {
      toast({ type: 'error', title: 'Could not change plan', description: error.message });
    } finally {
      setChanging(null);
    }
  };

  const invoiceColumns = [
    {
      key: 'id',
      header: 'Invoice',
      render: (row) => <span className="font-mono text-[12px] text-ink-900">{row.id}</span>,
    },
    {
      key: 'period',
      header: 'Period',
      hideBelow: 'sm',
      render: (row) => <span className="text-[12.5px] text-ink-700">{row.period}</span>,
    },
    {
      key: 'plan',
      header: 'Plan',
      hideBelow: 'md',
      render: (row) => <Badge size="sm">{row.plan}</Badge>,
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
      render: () => (
        <Badge tone="success" size="sm" dot>
          Paid
        </Badge>
      ),
    },
    {
      key: 'date',
      header: 'Date',
      align: 'right',
      hideBelow: 'lg',
      render: (row) => <span className="text-[11.5px] text-ink-400">{formatDate(row.date)}</span>,
    },
    {
      key: 'action',
      header: '',
      align: 'right',
      render: () => (
        <button
          type="button"
          onClick={() =>
            toast({
              type: 'info',
              title: 'Invoice download unavailable',
              description: 'PDF generation is a backend responsibility.',
            })
          }
          className="rounded-md p-1.5 text-ink-400 transition-colors hover:bg-surface-sunken hover:text-ink-800"
          aria-label="Download invoice"
        >
          <Download className="size-3.5" />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Subscription"
        eyebrow="Billing"
        description={
          <span className="flex flex-wrap items-center gap-2">
            Plan limits, usage and invoice history for {user?.shopName}. <MockBadge />
          </span>
        }
      />

      {shop?.planStatus === 'past_due' ? (
        <MockNotice tone="warn" icon={TriangleAlert} title="Payment past due">
          New orders are paused until the outstanding invoice is cleared. Update your payment method
          to restore service.
        </MockNotice>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardHeader
            title="Current plan"
            description={plan.tagline}
            icon={Sparkles}
            action={
              <Badge
                tone={
                  shop?.planStatus === 'active'
                    ? 'success'
                    : shop?.planStatus === 'trial'
                      ? 'info'
                      : 'warning'
                }
                dot
              >
                {shop?.planStatus === 'trial'
                  ? 'Trial'
                  : shop?.planStatus === 'past_due'
                    ? 'Past due'
                    : 'Active'}
              </Badge>
            }
          />
          <div className="px-5 pb-5">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-[28px] font-semibold tracking-[-0.03em] text-ink-900">
                  {plan.name}
                </p>
                <p className="mt-0.5 text-[13px] text-ink-500">
                  {plan.price === 0 ? 'Free forever' : `${formatCurrency(plan.price)} / month`} ·{' '}
                  {plan.limits.commission} commission
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-ink-400">Renews</p>
                <p className="text-[13px] font-medium text-ink-900">
                  {shop?.planRenewsOn ? formatDate(shop.planRenewsOn) : '—'}
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-4 border-t border-line pt-4">
              <div>
                <div className="mb-1.5 flex justify-between text-[11.5px]">
                  <span className="text-ink-500">Machines</span>
                  <span className="tabular-nums text-ink-800">
                    {machineCount} / {plan.limits.machines}
                  </span>
                </div>
                <ProgressBar
                  value={machineUsage}
                  tone={machineUsage > 90 ? 'danger' : machineUsage > 70 ? 'warn' : 'brand'}
                  size="sm"
                />
              </div>
              <div>
                <div className="mb-1.5 flex justify-between text-[11.5px]">
                  <span className="text-ink-500">Monthly job quota</span>
                  <span className="tabular-nums text-ink-800">
                    {Math.round(plan.limits.monthlyJobs * 0.34).toLocaleString('en-IN')} /{' '}
                    {plan.limits.monthlyJobs.toLocaleString('en-IN')}
                  </span>
                </div>
                <ProgressBar value={34} tone="brand" size="sm" />
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" icon={CreditCard}>
                Update payment method
              </Button>
              <Button variant="ghost" size="sm" icon={Receipt} onClick={() => invoices.refetch()}>
                Refresh invoices
              </Button>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="What's included" icon={Gauge} />
          <ul className="space-y-2.5 px-5 pb-5">
            {plan.features.map((feature) => (
              <li
                key={feature}
                className="flex items-start gap-2 text-[12.5px] leading-snug text-ink-600"
              >
                <Check className="mt-0.5 size-3.5 shrink-0 text-success" strokeWidth={2.5} />
                {feature}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div>
        <h2 className="text-[15px] font-semibold text-ink-900">Change plan</h2>
        <p className="mt-0.5 text-[12.5px] text-ink-500">
          Plan changes are simulated here — no billing is triggered in this preview.
        </p>

        <div className="mt-3 grid gap-4 lg:grid-cols-3">
          {PLAN_CATALOG.map((option) => {
            const current = option.id === shop?.planId;
            const isUpgrade = option.price > plan.price;
            return (
              <div
                key={option.id}
                className={cn(
                  'flex flex-col rounded-xl border bg-white p-5 transition-all',
                  current
                    ? 'border-brand-500 ring-2 ring-brand-500/10'
                    : 'border-line hover:border-line-strong',
                )}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[14px] font-semibold text-ink-900">{option.name}</p>
                    <p className="mt-0.5 text-[11.5px] text-ink-500">{option.tagline}</p>
                  </div>
                  {current ? (
                    <Badge tone="brand" size="sm">
                      Current
                    </Badge>
                  ) : null}
                </div>

                <p className="mt-4 text-[24px] font-semibold tracking-tight text-ink-900">
                  {option.price === 0 ? 'Free' : formatCurrency(option.price)}
                  {option.price !== 0 ? (
                    <span className="ml-1 text-[11.5px] font-normal text-ink-400">/mo</span>
                  ) : null}
                </p>
                <p className="mt-0.5 text-[11px] text-ink-400">
                  {option.limits.machines} machines · {option.limits.commission} commission
                </p>

                <ul className="mt-4 flex-1 space-y-1.5">
                  {option.features.slice(0, 4).map((feature) => (
                    <li key={feature} className="flex items-start gap-1.5 text-[12px] text-ink-600">
                      <Check className="mt-0.5 size-3 shrink-0 text-ink-300" strokeWidth={2.5} />
                      {feature}
                    </li>
                  ))}
                </ul>

                <Button
                  className="mt-4 w-full"
                  size="sm"
                  variant={current ? 'secondary' : isUpgrade ? 'primary' : 'secondary'}
                  disabled={current}
                  loading={changing === option.id}
                  onClick={() => selectPlan(option.id)}
                >
                  {current
                    ? 'Current plan'
                    : isUpgrade
                      ? `Upgrade to ${option.name}`
                      : `Switch to ${option.name}`}
                </Button>
              </div>
            );
          })}
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardHeader
          title="Invoice history"
          description="Platform subscription invoices"
          icon={Receipt}
        />
        <DataTable columns={invoiceColumns} rows={invoices.data ?? []} loading={invoices.loading} />
      </Card>

      <MockNotice tone="warn" title="Billing is simulated">
        Plan changes, payment method updates and invoice downloads do not contact any billing
        provider. Real subscription billing will be handled by the backend with a payment gateway
        subscription object.
      </MockNotice>
    </div>
  );
}
