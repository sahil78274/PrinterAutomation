import { useMemo, useState } from 'react';
import { ArrowDownToLine, Banknote, CreditCard, Download, TrendingUp, Wallet } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Card, { CardHeader } from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import StatCard from '../../components/ui/StatCard.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import DonutChart from '../../components/charts/DonutChart.jsx';
import BarChart from '../../components/charts/BarChart.jsx';
import Badge from '../../components/ui/Badge.jsx';
import { FilterTabs, SearchInput } from '../../components/ui/FilterBar.jsx';
import { MockBadge, MockNotice } from '../../components/ui/MockNotice.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { getOrders, getPayouts } from '../../services/api.js';
import { downloadBlob, formatCurrency, formatDate } from '../../lib/utils.js';
import { useToast } from '../../context/ToastContext.jsx';

export default function ShopPayments() {
  const { user } = useAuth();
  const { toast } = useToast();
  const payouts = useAsync(() => getPayouts(user?.shopId), [user?.shopId]);
  const orders = useAsync(() => getOrders({ shopId: user?.shopId }), [user?.shopId]);
  const [tab, setTab] = useState('settlements');
  const [query, setQuery] = useState('');

  const paidOrders = useMemo(
    () => (orders.data ?? []).filter((o) => o.paymentStatus === 'success' || o.simulated),
    [orders.data],
  );

  const gross = paidOrders.reduce((sum, o) => sum + o.amount, 0);
  const fees = paidOrders.reduce((sum, o) => sum + (o.platformFee ?? 0), 0);
  const net = gross - fees;
  const settled = (payouts.data ?? [])
    .filter((p) => p.status === 'settled')
    .reduce((sum, p) => sum + p.net, 0);
  const processing = (payouts.data ?? [])
    .filter((p) => p.status === 'processing')
    .reduce((sum, p) => sum + p.net, 0);

  const methodSplit = useMemo(() => {
    const map = paidOrders.reduce((acc, o) => {
      const key = o.paymentMethod ?? 'Other';
      acc[key] = (acc[key] ?? 0) + o.amount;
      return acc;
    }, {});
    return Object.entries(map).map(([label, value]) => ({ label, value: Math.round(value) }));
  }, [paidOrders]);

  const dailySeries = useMemo(() => {
    const days = Array.from({ length: 14 }).map((_, i) => {
      const day = new Date(Date.now() - (13 - i) * 86400000);
      const key = day.toISOString().slice(0, 10);
      return {
        key,
        label: day.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
        value: 0,
      };
    });
    paidOrders.forEach((order) => {
      const key = new Date(order.createdAt).toISOString().slice(0, 10);
      const bucket = days.find((d) => d.key === key);
      if (bucket) bucket.value += order.amount;
    });
    return days.map((d) => ({ ...d, value: Math.round(d.value) }));
  }, [paidOrders]);

  const filteredPayouts = (payouts.data ?? []).filter((p) =>
    `${p.id} ${p.period} ${p.ref}`.toLowerCase().includes(query.toLowerCase()),
  );

  const filteredOrders = paidOrders.filter((o) =>
    `${o.id} ${o.customerName} ${o.paymentRef ?? ''}`.toLowerCase().includes(query.toLowerCase()),
  );

  const exportSettlements = () => {
    const rows = [
      [
        'Payout ID',
        'Period',
        'Orders',
        'Gross',
        'Platform fee',
        'Net',
        'Status',
        'Released',
        'Reference',
      ],
      ...filteredPayouts.map((p) => [
        p.id,
        p.period,
        p.orders,
        p.gross,
        p.fee,
        p.net,
        p.status,
        p.releasedOn ?? '',
        p.ref,
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${v}"`).join(',')).join('\n');
    downloadBlob(csv, 'smartprint-settlements.csv', 'text/csv');
    toast({ type: 'success', title: 'Settlement report exported' });
  };

  const payoutColumns = [
    {
      key: 'id',
      header: 'Payout',
      render: (row) => (
        <div>
          <p className="font-mono text-[12px] font-medium text-ink-900">{row.id}</p>
          <p className="text-[11px] text-ink-400">{row.period}</p>
        </div>
      ),
    },
    {
      key: 'orders',
      header: 'Orders',
      align: 'right',
      hideBelow: 'sm',
      render: (row) => <span className="tabular-nums text-ink-700">{row.orders}</span>,
    },
    {
      key: 'gross',
      header: 'Gross',
      align: 'right',
      hideBelow: 'md',
      render: (row) => (
        <span className="tabular-nums text-ink-700">{formatCurrency(row.gross)}</span>
      ),
    },
    {
      key: 'fee',
      header: 'Fee',
      align: 'right',
      hideBelow: 'md',
      render: (row) => (
        <span className="tabular-nums text-ink-400">−{formatCurrency(row.fee)}</span>
      ),
    },
    {
      key: 'net',
      header: 'Net',
      align: 'right',
      render: (row) => (
        <span className="tabular-nums font-medium text-ink-900">{formatCurrency(row.net)}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <Badge tone={row.status === 'settled' ? 'success' : 'info'} size="sm" dot>
          {row.status === 'settled' ? 'Settled' : 'Processing'}
        </Badge>
      ),
    },
    {
      key: 'released',
      header: 'Released',
      align: 'right',
      hideBelow: 'lg',
      render: (row) => (
        <div>
          <p className="text-[11.5px] text-ink-600">
            {row.releasedOn ? formatDate(row.releasedOn) : '—'}
          </p>
          <p className="font-mono text-[10px] text-ink-400">{row.ref}</p>
        </div>
      ),
    },
  ];

  const orderColumns = [
    {
      key: 'id',
      header: 'Order',
      render: (row) => (
        <div>
          <p className="font-mono text-[12px] font-medium text-ink-900">{row.id}</p>
          <p className="text-[11px] text-ink-400">{formatDate(row.createdAt)}</p>
        </div>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      hideBelow: 'sm',
      render: (row) => <span className="text-[12.5px] text-ink-700">{row.customerName}</span>,
    },
    {
      key: 'method',
      header: 'Method',
      hideBelow: 'md',
      render: (row) => (
        <span className="inline-flex items-center gap-1 text-[12px] text-ink-600">
          <CreditCard className="size-3 text-ink-400" />
          {row.paymentMethod ?? '—'}
        </span>
      ),
    },
    {
      key: 'ref',
      header: 'Reference',
      hideBelow: 'lg',
      render: (row) => (
        <span className="font-mono text-[10.5px] text-ink-400">{row.paymentRef ?? '—'}</span>
      ),
    },
    {
      key: 'gross',
      header: 'Amount',
      align: 'right',
      render: (row) => (
        <span className="tabular-nums text-[12.5px] text-ink-900">
          {formatCurrency(row.amount)}
        </span>
      ),
    },
    {
      key: 'fee',
      header: 'Fee',
      align: 'right',
      hideBelow: 'md',
      render: (row) => (
        <span className="tabular-nums text-[12.5px] text-ink-400">
          −{formatCurrency(row.platformFee ?? 0)}
        </span>
      ),
    },
    {
      key: 'net',
      header: 'Your earning',
      align: 'right',
      render: (row) => (
        <span className="tabular-nums text-[12.5px] font-medium text-ink-900">
          {formatCurrency(row.shopEarning ?? row.amount)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Payment reports"
        eyebrow="Finance"
        description={
          <span className="flex flex-wrap items-center gap-2">
            Collections, platform fees and settlement history for {user?.shopName}. <MockBadge />
          </span>
        }
        actions={
          <Button size="md" variant="secondary" icon={Download} onClick={exportSettlements}>
            Export settlements
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Gross collections"
          value={formatCurrency(gross)}
          hint="all paid orders in dataset"
          icon={Banknote}
          tone="success"
          delta={9}
        />
        <StatCard
          label="Platform fees"
          value={formatCurrency(fees)}
          hint="commission per order"
          icon={Wallet}
          tone="ink"
        />
        <StatCard
          label="Net earnings"
          value={formatCurrency(net)}
          hint={`${settled ? formatCurrency(settled) : '₹0'} settled`}
          icon={TrendingUp}
        />
        <StatCard
          label="In processing"
          value={formatCurrency(processing)}
          hint="next payout cycle"
          icon={ArrowDownToLine}
          tone="warn"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader
            title="Daily collections · last 14 days"
            description="Customer payments received"
          />
          <div className="px-5 pb-5">
            <BarChart data={dailySeries} yKey="value" valueFormat="currency" height={200} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Payment methods" description="Share of collected value" />
          <div className="px-5 pb-5">
            <DonutChart
              data={methodSplit}
              size={140}
              thickness={14}
              centerLabel="collected"
              centerValue={formatCurrency(gross, { compact: true })}
            />
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <FilterTabs
            tabs={[
              { value: 'settlements', label: 'Settlements', count: payouts.data?.length ?? 0 },
              { value: 'transactions', label: 'Transactions', count: paidOrders.length },
            ]}
            value={tab}
            onChange={setTab}
          />
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search reference or period…"
            className="w-full sm:w-64"
          />
        </div>

        {tab === 'settlements' ? (
          <DataTable columns={payoutColumns} rows={filteredPayouts} loading={payouts.loading} />
        ) : (
          <DataTable
            columns={orderColumns}
            rows={filteredOrders.slice(0, 40)}
            loading={orders.loading}
          />
        )}
      </Card>

      <MockNotice tone="warn" title="Simulated financial data">
        Payments in this preview never touch a real gateway. Settlement rows are static sample data.
        In production, payouts are generated by the backend after gateway reconciliation and
        transferred to the payout account configured in your shop profile.
      </MockNotice>
    </div>
  );
}
