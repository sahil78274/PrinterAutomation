import { useMemo, useState } from 'react';
import { Check, RefreshCw, Sparkles, TriangleAlert, Users } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Card, { CardHeader } from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import Badge from '../../components/ui/Badge.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import BarChart from '../../components/charts/BarChart.jsx';
import { ProgressBar } from '../../components/charts/ProgressBar.jsx';
import { FilterTabs } from '../../components/ui/FilterBar.jsx';
import { MockBadge, MockNotice } from '../../components/ui/MockNotice.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { changePlan, getShops } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { PLAN_CATALOG } from '../../lib/constants.js';
import { formatCurrency, formatDate } from '../../lib/utils.js';

export default function AdminSubscriptions() {
  const { toast } = useToast();
  const shops = useAsync(() => getShops(), []);
  const [tab, setTab] = useState('all');
  const [busy, setBusy] = useState(null);

  const list = useMemo(() => shops.data ?? [], [shops.data]);

  const revenueByPlan = useMemo(
    () =>
      PLAN_CATALOG.map((plan) => ({
        label: plan.name,
        value:
          list.filter((s) => s.planId === plan.id && s.planStatus === 'active').length * plan.price,
      })),
    [list],
  );

  const mrr = revenueByPlan.reduce((sum, item) => sum + item.value, 0);
  const activeCount = list.filter((s) => s.planStatus === 'active').length;
  const trialCount = list.filter((s) => s.planStatus === 'trial').length;
  const pastDue = list.filter((s) => s.planStatus === 'past_due');

  const filtered = list.filter((shop) => (tab === 'all' ? true : shop.planId === tab));

  const move = async (shopId, planId) => {
    setBusy(shopId);
    try {
      await changePlan(shopId, planId);
      toast({
        type: 'success',
        title: 'Subscription updated',
        description: 'Simulated plan change.',
      });
      shops.refetch();
    } catch (error) {
      toast({ type: 'error', title: 'Failed', description: error.message });
    } finally {
      setBusy(null);
    }
  };

  const columns = [
    {
      key: 'shop',
      header: 'Shop',
      render: (row) => (
        <div>
          <p className="text-[12.5px] font-medium text-ink-900">{row.name}</p>
          <p className="text-[10.5px] text-ink-400">
            {row.city} · {row.machineCount} machine{row.machineCount === 1 ? '' : 's'}
          </p>
        </div>
      ),
    },
    {
      key: 'plan',
      header: 'Plan',
      render: (row) => {
        const plan = PLAN_CATALOG.find((p) => p.id === row.planId);
        return (
          <div>
            <p className="text-[12px] font-medium text-ink-800">{plan?.name}</p>
            <p className="text-[10.5px] text-ink-400">
              {plan?.price === 0 ? 'Free' : `${formatCurrency(plan?.price ?? 0)}/mo`}
            </p>
          </div>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <Badge
          size="sm"
          dot
          tone={
            row.planStatus === 'active' ? 'success' : row.planStatus === 'trial' ? 'info' : 'danger'
          }
        >
          {row.planStatus.replace('_', ' ')}
        </Badge>
      ),
    },
    {
      key: 'renews',
      header: 'Renews',
      hideBelow: 'sm',
      render: (row) => (
        <span className="text-[11.5px] text-ink-600">{formatDate(row.planRenewsOn)}</span>
      ),
    },
    {
      key: 'revenue',
      header: 'Shop revenue',
      align: 'right',
      hideBelow: 'md',
      render: (row) => (
        <span className="tabular-nums text-[12.5px] text-ink-900">
          {formatCurrency(row.revenue, { compact: true })}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          {PLAN_CATALOG.filter((p) => p.id !== row.planId).map((p) => (
            <button
              key={p.id}
              type="button"
              disabled={busy === row.id}
              onClick={() => move(row.id, p.id)}
              className="rounded border border-line px-1.5 py-0.5 text-[10.5px] font-medium text-ink-600 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 disabled:opacity-40"
            >
              → {p.name}
            </button>
          ))}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Billing"
        title="Subscription management"
        description={
          <span className="flex flex-wrap items-center gap-2">
            Plan distribution, recurring revenue and tenant billing status. <MockBadge />
          </span>
        }
        actions={
          <Button variant="secondary" size="md" icon={RefreshCw} onClick={() => shops.refetch()}>
            Refresh
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'MRR', value: formatCurrency(mrr), tone: 'text-ink-900' },
          { label: 'Active plans', value: activeCount, tone: 'text-success' },
          { label: 'On trial', value: trialCount, tone: 'text-brand-600' },
          { label: 'Past due', value: pastDue.length, tone: 'text-danger' },
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

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader
            title="Recurring revenue by plan"
            description="Monthly, active subscriptions only"
            icon={Sparkles}
          />
          <div className="px-5 pb-5">
            <BarChart data={revenueByPlan} yKey="value" valueFormat="currency" height={170} />
          </div>
        </Card>

        <Card>
          <CardHeader title="Plan distribution" description="Shops per tier" icon={Users} />
          <div className="space-y-4 px-5 pb-5">
            {PLAN_CATALOG.map((plan) => {
              const count = list.filter((s) => s.planId === plan.id).length;
              const pct = list.length ? Math.round((count / list.length) * 100) : 0;
              return (
                <div key={plan.id}>
                  <div className="mb-1.5 flex items-baseline justify-between text-[11.5px]">
                    <span className="font-medium text-ink-800">{plan.name}</span>
                    <span className="tabular-nums text-ink-500">
                      {count} · {pct}%
                    </span>
                  </div>
                  <ProgressBar
                    value={pct}
                    tone={plan.id === 'scale' ? 'ink' : plan.id === 'growth' ? 'brand' : 'success'}
                    size="sm"
                  />
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {pastDue.length ? (
        <MockNotice
          tone="warn"
          icon={TriangleAlert}
          title={`${pastDue.length} shop needs billing attention`}
        >
          {pastDue.map((s) => s.name).join(', ')} — customer ordering is paused for these shops
          until the invoice is cleared.
        </MockNotice>
      ) : null}

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <FilterTabs
            tabs={[
              { value: 'all', label: 'All plans', count: list.length },
              ...PLAN_CATALOG.map((p) => ({
                value: p.id,
                label: p.name,
                count: list.filter((s) => s.planId === p.id).length,
              })),
            ]}
            value={tab}
            onChange={setTab}
          />
        </div>
        <DataTable columns={columns} rows={filtered} loading={shops.loading} />
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {PLAN_CATALOG.map((plan) => (
          <Card key={plan.id} className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[14px] font-semibold text-ink-900">{plan.name}</p>
                <p className="text-[11.5px] text-ink-500">{plan.limits.machines} machines max</p>
              </div>
              <p className="text-[15px] font-semibold tabular-nums text-ink-900">
                {plan.price === 0 ? 'Free' : `${formatCurrency(plan.price)}/mo`}
              </p>
            </div>
            <ul className="mt-3 space-y-1.5">
              {plan.features.slice(0, 3).map((feature) => (
                <li key={feature} className="flex items-start gap-1.5 text-[11.5px] text-ink-600">
                  <Check className="mt-0.5 size-3 shrink-0 text-success" strokeWidth={2.5} />
                  {feature}
                </li>
              ))}
            </ul>
            <p className="mt-3 border-t border-line pt-3 text-[10.5px] text-ink-400">
              {plan.limits.commission} platform commission ·{' '}
              {plan.limits.monthlyJobs.toLocaleString('en-IN')} jobs/month
            </p>
          </Card>
        ))}
      </div>

      <MockNotice tone="warn" title="Billing actions are simulated">
        Plan changes here mutate the in-memory demo store only. Production billing runs through a
        payment gateway subscription object, webhooks and a dunning flow for past-due accounts.
      </MockNotice>
    </div>
  );
}
