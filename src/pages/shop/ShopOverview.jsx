import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Banknote,
  Clock3,
  FileText,
  Printer,
  ReceiptText,
  TrendingUp,
  TriangleAlert,
} from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Button from '../../components/ui/Button.jsx';
import StatCard from '../../components/ui/StatCard.jsx';
import Card, { CardHeader } from '../../components/ui/Card.jsx';
import AreaChart from '../../components/charts/AreaChart.jsx';
import DonutChart from '../../components/charts/DonutChart.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import { OrderStatusBadge } from '../../components/orders/OrderStatusBadge.jsx';
import OrderDetailDrawer from '../../components/orders/OrderDetailDrawer.jsx';
import MachineCard from '../../components/shop/MachineCard.jsx';
import QrModal from '../../components/machines/QrModal.jsx';
import MachineConfigModal from '../../components/shop/MachineConfigModal.jsx';
import { MockBadge } from '../../components/ui/MockNotice.jsx';
import { SkeletonStatGrid, Skeleton } from '../../components/ui/Skeleton.jsx';
import { EmptyState } from '../../components/ui/Avatar.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { getMachines, getOrders, getShopAnalytics } from '../../services/api.js';
import { ORDER_STATUS_META } from '../../lib/constants.js';
import { formatCurrency, formatNumber, timeAgo } from '../../lib/utils.js';

export default function ShopOverview() {
  const { user } = useAuth();
  const shopId = user?.shopId;
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [qrMachine, setQrMachine] = useState(null);
  const [configMachine, setConfigMachine] = useState(null);

  const analytics = useAsync(() => getShopAnalytics(shopId), [shopId]);
  const orders = useAsync(() => getOrders({ shopId, limit: 6 }), [shopId]);
  const machines = useAsync(() => getMachines({ shopId }), [shopId]);

  const reload = () => {
    analytics.refetch();
    orders.refetch();
    machines.refetch();
  };

  const data = analytics.data;
  const machineList = machines.data ?? [];

  const donutData = (data?.statusBreakdown ?? [])
    .filter((entry) => entry.count > 0)
    .map((entry) => ({
      label: ORDER_STATUS_META[entry.status]?.label ?? entry.status,
      value: entry.count,
      color:
        entry.status === 'completed'
          ? '#0E9F6E'
          : entry.status === 'printing' || entry.status === 'queued' || entry.status === 'paid'
            ? '#2459E8'
            : entry.status === 'failed'
              ? '#DC2626'
              : entry.status === 'refunded'
                ? '#C27803'
                : '#7A8DA8',
    }));

  const columns = [
    {
      key: 'id',
      header: 'Order',
      render: (row) => (
        <div>
          <p className="font-mono text-[12px] font-medium text-ink-900">{row.id}</p>
          <p className="text-[11px] text-ink-400">{row.machineId}</p>
        </div>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      hideBelow: 'sm',
      render: (row) => (
        <div>
          <p className="truncate text-[12.5px] text-ink-800">{row.customerName}</p>
          <p className="text-[11px] text-ink-400">
            {row.documents?.[0]?.name?.slice(0, 26) ?? 'Document'}
            {(row.documents?.[0]?.name?.length ?? 0) > 26 ? '…' : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'pages',
      header: 'Pages',
      align: 'right',
      hideBelow: 'md',
      render: (row) => (
        <span className="tabular-nums text-[12.5px] text-ink-700">
          {row.pageCount * row.copies}
        </span>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      render: (row) => (
        <span className="tabular-nums text-[12.5px] font-medium text-ink-900">
          {formatCurrency(row.amount)}
        </span>
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
      hideBelow: 'lg',
      render: (row) => <span className="text-[11.5px] text-ink-400">{timeAgo(row.createdAt)}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Good day, ${user?.name?.split(' ')[0] ?? 'there'}`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {user?.shopName} · machine activity and revenue for today.
            <MockBadge />
          </span>
        }
        actions={
          <>
            <Button variant="secondary" size="md" to="/shop/machines" icon={Printer}>
              Manage machines
            </Button>
            <Button size="md" to="/shop/orders" iconRight={ArrowRight}>
              All orders
            </Button>
          </>
        }
      />

      {/* KPIs */}
      {analytics.loading ? (
        <SkeletonStatGrid count={4} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Today's orders"
            value={formatNumber(data?.todayOrders ?? 0)}
            delta={12}
            hint="vs. yesterday"
            icon={ReceiptText}
            spark={(data?.series ?? []).slice(-8).map((d) => d.orders)}
          />
          <StatCard
            label="Today's revenue"
            value={formatCurrency(data?.todayRevenue ?? 0)}
            delta={8}
            hint="vs. yesterday"
            icon={Banknote}
            tone="success"
            spark={(data?.series ?? []).slice(-8).map((d) => d.revenue)}
          />
          <StatCard
            label="Pages printed today"
            value={formatNumber(data?.todayPages ?? 0)}
            hint={`${data?.weekOrders ?? 0} orders this week`}
            icon={FileText}
            tone="ink"
          />
          <StatCard
            label="Active print jobs"
            value={formatNumber(data?.pendingJobs ?? 0)}
            hint="paid, queued or printing"
            icon={Clock3}
            tone="warn"
          />
        </div>
      )}

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader
            title="Revenue · last 14 days"
            description="Paid orders only, before platform fee"
            action={
              <div className="text-right">
                <p className="text-[11px] text-ink-400">30-day total</p>
                <p className="text-[14px] font-semibold tabular-nums text-ink-900">
                  {formatCurrency(data?.monthRevenue ?? 0)}
                </p>
              </div>
            }
          />
          <div className="px-2 pb-3">
            {analytics.loading ? (
              <Skeleton className="mx-3 h-[220px] w-[calc(100%-1.5rem)]" />
            ) : (
              <AreaChart
                data={data?.series ?? []}
                yKey="revenue"
                valueFormat="currency"
                height={228}
              />
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Order mix" description="All orders by current status" />
          <div className="px-5 pb-5">
            {analytics.loading ? (
              <Skeleton className="h-[180px] w-full" />
            ) : donutData.length ? (
              <DonutChart data={donutData} centerLabel="orders" size={150} thickness={14} />
            ) : (
              <EmptyState
                title="No orders yet"
                description="Orders will appear once customers scan a QR."
              />
            )}
          </div>
        </Card>
      </div>

      {/* Orders + machines */}
      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <Card className="overflow-hidden">
          <CardHeader
            title="Recent print jobs"
            description="Click a row for the full job record"
            action={
              <Link
                to="/shop/orders"
                className="inline-flex items-center gap-1 text-[12px] font-medium text-brand-600 hover:text-brand-700"
              >
                View all <ArrowRight className="size-3" />
              </Link>
            }
          />
          <DataTable
            columns={columns}
            rows={orders.data ?? []}
            loading={orders.loading}
            onRowClick={setSelectedOrder}
            className="-mt-1"
          />
        </Card>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[14px] font-semibold text-ink-900">Machines</h3>
              <p className="text-[11.5px] text-ink-500">
                {machineList.filter((m) => m.status === 'online' || m.status === 'busy').length} of{' '}
                {machineList.length} reachable
              </p>
            </div>
            <Link
              to="/shop/machines"
              className="text-[12px] font-medium text-brand-600 hover:text-brand-700"
            >
              Manage
            </Link>
          </div>

          {machines.loading ? (
            <div className="space-y-3">
              {[0, 1].map((i) => (
                <Skeleton key={i} className="h-[150px] w-full rounded-xl" />
              ))}
            </div>
          ) : (
            machineList
              .slice(0, 2)
              .map((machine) => (
                <MachineCard
                  key={machine.id}
                  machine={machine}
                  onQr={setQrMachine}
                  onConfigure={setConfigMachine}
                />
              ))
          )}

          {machineList.some((m) => m.status === 'maintenance' || m.status === 'offline') ? (
            <div className="rounded-xl border border-warn/25 bg-warn/[0.05] p-3.5">
              <div className="flex items-start gap-2">
                <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-warn" />
                <div>
                  <p className="text-[12px] font-semibold text-warn">Attention needed</p>
                  <ul className="mt-1 space-y-0.5 text-[11.5px] text-ink-600">
                    {machineList
                      .filter((m) => m.status === 'maintenance' || m.status === 'offline')
                      .slice(0, 3)
                      .map((m) => (
                        <li key={m.id}>
                          {m.id} · {m.status === 'offline' ? 'offline' : 'under maintenance'}
                        </li>
                      ))}
                  </ul>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Quick actions */}
      <Card className="p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-[14px] font-semibold text-ink-900">Grow your print counter</h3>
            <p className="mt-0.5 text-[12.5px] text-ink-500">
              Add a machine, adjust rates, or review your settlement history.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" to="/shop/pricing">
              Update pricing
            </Button>
            <Button variant="secondary" size="sm" to="/shop/payments">
              Payment reports
            </Button>
            <Button size="sm" to="/shop/subscription" icon={TrendingUp}>
              Upgrade plan
            </Button>
          </div>
        </div>
      </Card>

      <OrderDetailDrawer
        order={selectedOrder}
        open={Boolean(selectedOrder)}
        onClose={() => setSelectedOrder(null)}
        onChanged={reload}
      />
      <QrModal machine={qrMachine} open={Boolean(qrMachine)} onClose={() => setQrMachine(null)} />
      <MachineConfigModal
        machine={configMachine}
        open={Boolean(configMachine)}
        onClose={() => setConfigMachine(null)}
        onSaved={reload}
      />
    </div>
  );
}
