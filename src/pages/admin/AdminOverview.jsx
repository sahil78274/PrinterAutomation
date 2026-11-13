import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BadgeIndianRupee,
  Building2,
  CheckCircle2,
  MonitorCheck,
  MonitorX,
  Printer,
  ReceiptText,
  RefreshCw,
  Store,
  TrendingUp,
} from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader.jsx';
import StatCard from '../../components/ui/StatCard.jsx';
import Card, { CardHeader } from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import AreaChart from '../../components/charts/AreaChart.jsx';
import DonutChart from '../../components/charts/DonutChart.jsx';
import BarChart from '../../components/charts/BarChart.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import Badge from '../../components/ui/Badge.jsx';
import { OrderStatusBadge } from '../../components/orders/OrderStatusBadge.jsx';
import OrderDetailDrawer from '../../components/orders/OrderDetailDrawer.jsx';
import { MockBadge } from '../../components/ui/MockNotice.jsx';
import { SkeletonStatGrid, Skeleton } from '../../components/ui/Skeleton.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { getOrders, getPlatformAnalytics, getShops } from '../../services/api.js';
import { formatCurrency, formatNumber, percent, timeAgo } from '../../lib/utils.js';
import { PLAN_CATALOG } from '../../lib/constants.js';

export default function AdminOverview() {
  const analytics = useAsync(() => getPlatformAnalytics(), []);
  const shops = useAsync(() => getShops(), []);
  const orders = useAsync(() => getOrders({ limit: 7 }), []);
  const [selected, setSelected] = useState(null);

  const data = analytics.data;
  const replenish = () => {
    analytics.refetch();
    shops.refetch();
    orders.refetch();
  };

  const machineHealth = [
    { label: 'Online', value: data?.onlineMachines ?? 0, color: '#0E9F6E' },
    { label: 'Offline', value: data?.offlineMachines ?? 0, color: '#A8B6C8' },
    { label: 'Maintenance', value: data?.maintenanceMachines ?? 0, color: '#C27803' },
  ];

  const planBars = (data?.planDistribution ?? []).map((entry) => ({
    label: PLAN_CATALOG.find((p) => p.id === entry.planId)?.name ?? entry.planId,
    value: entry.count,
  }));

  const columns = [
    {
      key: 'id',
      header: 'Job',
      render: (row) => (
        <div>
          <p className="font-mono text-[12px] font-medium text-ink-900">{row.id}</p>
          <p className="text-[10.5px] text-ink-400">{row.machineId}</p>
        </div>
      ),
    },
    {
      key: 'shop',
      header: 'Shop',
      hideBelow: 'sm',
      render: (row) => (
        <div className="max-w-[180px]">
          <p className="truncate text-[12.5px] text-ink-800">{row.shopName}</p>
          <p className="truncate text-[11px] text-ink-400">{row.customerName}</p>
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      render: (row) => (
        <div>
          <p className="tabular-nums text-[12.5px] font-medium text-ink-900">
            {formatCurrency(row.amount)}
          </p>
          <p className="text-[10.5px] text-ink-400">fee {formatCurrency(row.platformFee ?? 0)}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <OrderStatusBadge status={row.status} size="sm" />,
    },
    {
      key: 'time',
      header: 'Time',
      align: 'right',
      hideBelow: 'md',
      render: (row) => <span className="text-[11.5px] text-ink-400">{timeAgo(row.createdAt)}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Platform"
        title="Network overview"
        description={
          <span className="flex flex-wrap items-center gap-2">
            Every shop, machine and job on SmartPrint in one place.{' '}
            <MockBadge label="Demo dataset" />
          </span>
        }
        actions={
          <>
            <Button variant="secondary" size="md" icon={RefreshCw} onClick={replenish}>
              Refresh
            </Button>
            <Button size="md" to="/admin/machines" icon={Printer}>
              Register machine
            </Button>
          </>
        }
      />

      {analytics.loading ? (
        <SkeletonStatGrid count={4} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Registered shops"
            value={formatNumber(data?.totalShops ?? 0)}
            hint={`${data?.activeShops ?? 0} accepting orders`}
            icon={Store}
            delta={14}
            spark={(data?.series ?? []).slice(-8).map((d) => d.jobs)}
          />
          <StatCard
            label="Machines"
            value={formatNumber(data?.totalMachines ?? 0)}
            hint={`${data?.onlineMachines ?? 0} online`}
            icon={Printer}
            tone="success"
            delta={6}
          />
          <StatCard
            label="Print jobs"
            value={formatNumber(data?.totalJobs ?? 0)}
            hint={`${data?.jobsToday ?? 0} today`}
            icon={ReceiptText}
            tone="ink"
            delta={11}
          />
          <StatCard
            label="Platform revenue"
            value={formatCurrency(data?.platformRevenue ?? 0, { compact: true })}
            hint={`${formatCurrency(data?.gmv ?? 0, { compact: true })} GMV`}
            icon={BadgeIndianRupee}
            tone="warn"
            delta={17}
          />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader
            title="Revenue & job volume"
            description="Last 14 days across all shops"
            action={
              <div className="flex items-center gap-1.5 rounded-md bg-success/10 px-2 py-1 text-[11px] font-medium text-success">
                <TrendingUp className="size-3" />
                +12.4% w/w
              </div>
            }
          />
          <div className="px-2 pb-4">
            {analytics.loading ? (
              <Skeleton className="mx-3 h-[230px] w-[calc(100%-1.5rem)]" />
            ) : (
              <AreaChart
                data={data?.series ?? []}
                yKey="revenue"
                valueFormat="currency"
                height={236}
              />
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Machine health" description="Live status across the fleet" />
          <div className="px-5 pb-5">
            {analytics.loading ? (
              <Skeleton className="h-[150px] w-full" />
            ) : (
              <>
                <DonutChart
                  data={machineHealth}
                  size={146}
                  thickness={14}
                  centerLabel="machines"
                  centerValue={formatNumber(data?.totalMachines ?? 0)}
                />
                <div className="mt-5 grid grid-cols-2 gap-2 border-t border-line pt-4">
                  <HealthTile
                    icon={MonitorCheck}
                    label="Online"
                    value={data?.onlineMachines ?? 0}
                    tone="text-success"
                  />
                  <HealthTile
                    icon={MonitorX}
                    label="Offline"
                    value={data?.offlineMachines ?? 0}
                    tone="text-ink-400"
                  />
                </div>
              </>
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 overflow-hidden">
          <CardHeader
            title="Recent print jobs"
            description="Network-wide activity feed"
            action={
              <Link
                to="/admin/jobs"
                className="inline-flex items-center gap-1 text-[12px] font-medium text-brand-600 hover:text-brand-700"
              >
                Monitor all <ArrowRight className="size-3" />
              </Link>
            }
          />
          <DataTable
            columns={columns}
            rows={orders.data ?? []}
            loading={orders.loading}
            onRowClick={setSelected}
            className="-mt-1"
          />
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Plans" description="Shops per subscription tier" />
            <div className="px-5 pb-5">
              <BarChart data={planBars} yKey="value" height={130} color="#6094FA" />
            </div>
          </Card>

          <Card>
            <CardHeader title="Top cities" description="Shops by location" />
            <ul className="space-y-2.5 px-5 pb-5">
              {(data?.cityDistribution ?? [])
                .sort((a, b) => b.count - a.count)
                .slice(0, 5)
                .map((city) => (
                  <li key={city.city}>
                    <div className="mb-1 flex items-center justify-between text-[11.5px]">
                      <span className="inline-flex items-center gap-1.5 text-ink-600">
                        <Building2 className="size-3 text-ink-400" />
                        {city.city}
                      </span>
                      <span className="tabular-nums text-ink-800">{city.count}</span>
                    </div>
                    <div className="h-1 w-full overflow-hidden rounded-full bg-surface-sunken">
                      <div
                        className="h-full rounded-full bg-brand-500"
                        style={{ width: `${percent(city.count, data?.totalShops ?? 1)}%` }}
                      />
                    </div>
                  </li>
                ))}
            </ul>
          </Card>
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardHeader
          title="Shops needing attention"
          description="Past-due subscriptions or machines offline"
          action={
            <Button size="sm" variant="secondary" to="/admin/shops">
              Manage shops
            </Button>
          }
        />
        <DataTable
          columns={[
            {
              key: 'name',
              header: 'Shop',
              render: (row) => (
                <div>
                  <p className="text-[12.5px] font-medium text-ink-900">{row.name}</p>
                  <p className="text-[11px] text-ink-400">
                    {row.city} · {row.machineCount} machines
                  </p>
                </div>
              ),
            },
            {
              key: 'plan',
              header: 'Plan',
              hideBelow: 'sm',
              render: (row) => (
                <Badge
                  size="sm"
                  tone={
                    row.planStatus === 'past_due'
                      ? 'danger'
                      : row.planStatus === 'trial'
                        ? 'info'
                        : 'neutral'
                  }
                >
                  {row.planId} · {row.planStatus}
                </Badge>
              ),
            },
            {
              key: 'machines',
              header: 'Reachable',
              align: 'right',
              hideBelow: 'md',
              render: (row) => (
                <span className="tabular-nums text-[12px] text-ink-600">
                  {row.onlineMachines}/{row.machineCount}
                </span>
              ),
            },
            {
              key: 'revenue',
              header: 'Revenue',
              align: 'right',
              render: (row) => (
                <span className="tabular-nums text-[12.5px] font-medium text-ink-900">
                  {formatCurrency(row.revenue, { compact: true })}
                </span>
              ),
            },
            {
              key: 'status',
              header: 'Health',
              render: (row) => (
                <span className="inline-flex items-center gap-1.5 text-[11.5px]">
                  {row.planStatus === 'past_due' ? (
                    <>
                      <span className="size-1.5 rounded-full bg-danger" />
                      <span className="text-danger">Billing issue</span>
                    </>
                  ) : row.onlineMachines === 0 ? (
                    <>
                      <span className="size-1.5 rounded-full bg-warn" />
                      <span className="text-warn">No machines online</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="size-3 text-success" />
                      <span className="text-success">Healthy</span>
                    </>
                  )}
                </span>
              ),
            },
          ]}
          rows={(shops.data ?? []).filter(
            (s) => s.planStatus === 'past_due' || s.onlineMachines === 0,
          )}
          loading={shops.loading}
        />
      </Card>

      <OrderDetailDrawer
        order={selected}
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        onChanged={replenish}
        showShop
      />
    </div>
  );
}

function HealthTile({ icon: Icon, label, value, tone }) {
  return (
    <div className="rounded-lg border border-line bg-surface-muted/50 px-3 py-2.5">
      <Icon className={`size-3.5 ${tone}`} />
      <p className="mt-1.5 text-[16px] font-semibold tabular-nums text-ink-900">{value}</p>
      <p className="text-[10.5px] text-ink-400">{label}</p>
    </div>
  );
}
