import { useState } from 'react';
import {
  BadgeIndianRupee,
  FileBarChart,
  Filter,
  ReceiptText,
  ScanLine,
  Store,
  TrendingUp,
} from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Card, { CardHeader } from '../../components/ui/Card.jsx';
import StatCard from '../../components/ui/StatCard.jsx';
import Button from '../../components/ui/Button.jsx';
import AreaChart from '../../components/charts/AreaChart.jsx';
import BarChart from '../../components/charts/BarChart.jsx';
import DonutChart from '../../components/charts/DonutChart.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import { ProgressBar } from '../../components/charts/ProgressBar.jsx';
import { SegmentedControl } from '../../components/ui/Input.jsx';
import { MockBadge, MockNotice } from '../../components/ui/MockNotice.jsx';
import { SkeletonStatGrid, Skeleton } from '../../components/ui/Skeleton.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { getOrders, getPlatformAnalytics, getShops } from '../../services/api.js';
import { ORDER_STATUS_META } from '../../lib/constants.js';
import { formatCurrency, formatNumber, percent } from '../../lib/utils.js';

export default function AdminAnalytics() {
  const analytics = useAsync(() => getPlatformAnalytics(), []);
  const shops = useAsync(() => getShops(), []);
  const orders = useAsync(() => getOrders(), []);
  const [metric, setMetric] = useState('revenue');

  const data = analytics.data;
  const shopList = shops.data ?? [];
  const orderList = orders.data ?? [];

  const conversion = data
    ? {
        scans: data.funnel[0]?.value ?? 0,
        uploads: data.funnel[1]?.value ?? 0,
        paid: data.funnel[2]?.value ?? 0,
        printed: data.funnel[3]?.value ?? 0,
      }
    : null;

  const topShops = [...shopList].sort((a, b) => b.revenue - a.revenue).slice(0, 6);

  const statusDonut = Object.entries(
    orderList.reduce((acc, order) => {
      const label = ORDER_STATUS_META[order.status]?.label ?? order.status;
      acc[label] = (acc[label] ?? 0) + 1;
      return acc;
    }, {}),
  ).map(([label, value]) => ({ label, value }));

  const documentMix = Object.entries(
    orderList.reduce((acc, order) => {
      const key = order.color ? 'Colour' : 'Black & white';
      acc[key] = (acc[key] ?? 0) + order.pageCount * order.copies;
      return acc;
    }, {}),
  ).map(([label, value]) => ({ label, value }));

  const duplexShare = percent(
    orderList.filter((o) => o.sides === 'double').length,
    orderList.length,
  );

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Insights"
        title="Revenue analytics"
        description={
          <span className="flex flex-wrap items-center gap-2">
            Platform-wide performance, conversion and tenant contribution. <MockBadge />
          </span>
        }
        actions={
          <Button variant="secondary" size="md" icon={FileBarChart} onClick={() => window.print()}>
            Print report
          </Button>
        }
      />

      {analytics.loading ? (
        <SkeletonStatGrid count={4} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="GMV (all time)"
            value={formatCurrency(data?.gmv ?? 0, { compact: true })}
            hint="customer payments"
            icon={BadgeIndianRupee}
            tone="success"
            delta={13}
          />
          <StatCard
            label="Platform revenue"
            value={formatCurrency(data?.platformRevenue ?? 0, { compact: true })}
            hint="commissions earned"
            icon={TrendingUp}
            delta={16}
          />
          <StatCard
            label="Recurring revenue"
            value={formatCurrency(data?.mrr ?? 0)}
            hint="monthly subscriptions"
            icon={Store}
            tone="ink"
          />
          <StatCard
            label="Jobs per shop"
            value={Math.round((data?.totalJobs ?? 0) / (data?.totalShops || 1))}
            hint="average lifetime"
            icon={ReceiptText}
            tone="warn"
          />
        </div>
      )}

      <Card>
        <CardHeader
          title={metric === 'revenue' ? 'Revenue trend' : 'Job volume trend'}
          description="Last 14 days, all shops"
          action={
            <SegmentedControl
              size="sm"
              value={metric}
              onChange={setMetric}
              options={[
                { value: 'revenue', label: 'Revenue' },
                { value: 'jobs', label: 'Jobs' },
              ]}
              className="w-[170px]"
            />
          }
        />
        <div className="px-2 pb-5">
          {analytics.loading ? (
            <Skeleton className="mx-3 h-[260px] w-[calc(100%-1.5rem)]" />
          ) : (
            <AreaChart
              data={data?.series ?? []}
              yKey={metric}
              valueFormat={metric === 'revenue' ? 'currency' : 'number'}
              height={268}
              color={metric === 'revenue' ? '#2459E8' : '#0E9F6E'}
            />
          )}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Conversion funnel" description="QR scan → printed" icon={Filter} />
          <div className="space-y-4 px-5 pb-5">
            {conversion
              ? [
                  { label: 'QR scans', value: conversion.scans },
                  { label: 'Documents uploaded', value: conversion.uploads },
                  { label: 'Paid orders', value: conversion.paid },
                  { label: 'Jobs printed', value: conversion.printed },
                ].map((step, index, arr) => {
                  const pct = percent(step.value, arr[0].value);
                  return (
                    <div key={step.label}>
                      <div className="mb-1.5 flex items-baseline justify-between text-[11.5px]">
                        <span className="text-ink-600">{step.label}</span>
                        <span className="tabular-nums text-ink-800">
                          {formatNumber(step.value)} <span className="text-ink-400">({pct}%)</span>
                        </span>
                      </div>
                      <ProgressBar value={pct} tone={index === 3 ? 'success' : 'brand'} size="sm" />
                    </div>
                  );
                })
              : null}
            <p className="border-t border-line pt-3 text-[10.5px] leading-relaxed text-ink-400">
              Funnel figures are simulated estimates for the demo dataset.
            </p>
          </div>
        </Card>

        <Card>
          <CardHeader title="Job status mix" description="All-time distribution" icon={ScanLine} />
          <div className="px-5 pb-5">
            {orders.loading ? (
              <Skeleton className="h-[160px] w-full" />
            ) : (
              <DonutChart
                data={statusDonut}
                size={140}
                thickness={13}
                centerLabel="jobs"
                centerValue={formatNumber(orderList.length)}
              />
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Pages printed"
            description="Colour vs monochrome"
            icon={FileBarChart}
          />
          <div className="space-y-4 px-5 pb-5">
            {documentMix.map((item) => {
              const total = documentMix.reduce((sum, i) => sum + i.value, 0) || 1;
              return (
                <div key={item.label}>
                  <div className="mb-1.5 flex items-baseline justify-between text-[11.5px]">
                    <span className="text-ink-600">{item.label}</span>
                    <span className="tabular-nums text-ink-800">{formatNumber(item.value)}</span>
                  </div>
                  <ProgressBar
                    value={percent(item.value, total)}
                    tone={item.label === 'Colour' ? 'brand' : 'ink'}
                    size="sm"
                  />
                </div>
              );
            })}
            <div className="rounded-lg border border-line bg-surface-muted/50 p-3">
              <p className="text-[10.5px] uppercase tracking-[0.06em] text-ink-400">
                Duplex adoption
              </p>
              <p className="mt-0.5 text-[18px] font-semibold tabular-nums text-ink-900">
                {duplexShare}%
              </p>
              <p className="text-[10.5px] text-ink-400">of jobs use double-sided printing</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Top shops by revenue" description="Lifetime customer payments" />
          <div className="px-5 pb-5">
            <BarChart
              data={topShops.map((shop) => ({
                label: shop.name.split(' ')[0],
                value: Math.round(shop.revenue),
              }))}
              yKey="value"
              valueFormat="currency"
              height={185}
            />
          </div>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader title="Tenant leaderboard" description="Revenue, machines and orders" />
          <DataTable
            columns={[
              {
                key: 'name',
                header: 'Shop',
                render: (row) => (
                  <div>
                    <p className="text-[12.5px] font-medium text-ink-900">{row.name}</p>
                    <p className="text-[10.5px] text-ink-400">{row.city}</p>
                  </div>
                ),
              },
              {
                key: 'machines',
                header: 'Machines',
                align: 'right',
                hideBelow: 'sm',
                render: (row) => (
                  <span className="tabular-nums text-[12px] text-ink-600">
                    {row.onlineMachines}/{row.machineCount}
                  </span>
                ),
              },
              {
                key: 'orders',
                header: 'Orders',
                align: 'right',
                hideBelow: 'md',
                render: (row) => (
                  <span className="tabular-nums text-[12px] text-ink-600">
                    {formatNumber(row.totalOrders)}
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
            ]}
            rows={topShops}
            loading={shops.loading}
          />
        </Card>
      </div>

      <MockNotice tone="warn" title="Analytics preview">
        Aggregates are computed from the in-memory demo dataset, not a live warehouse. Production
        analytics will be served by aggregation pipelines or a time-series store, with date-range
        and cohort filters.
      </MockNotice>
    </div>
  );
}
