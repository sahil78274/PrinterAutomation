import { useMemo, useState } from 'react';
import { Download, RefreshCw, SearchX } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import DataTable, { TablePagination } from '../../components/ui/DataTable.jsx';
import Badge from '../../components/ui/Badge.jsx';
import { OrderStatusBadge } from '../../components/orders/OrderStatusBadge.jsx';
import OrderDetailDrawer from '../../components/orders/OrderDetailDrawer.jsx';
import { FilterTabs, SearchInput } from '../../components/ui/FilterBar.jsx';
import { MockBadge } from '../../components/ui/MockNotice.jsx';
import { SkeletonStatGrid } from '../../components/ui/Skeleton.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { getOrders, getPlatformAnalytics } from '../../services/api.js';
import { ORDER_STATUS, ORDER_STATUS_META } from '../../lib/constants.js';
import { downloadBlob, formatCurrency, formatDateTime, percent, timeAgo } from '../../lib/utils.js';
import { useToast } from '../../context/ToastContext.jsx';

const PAGE_SIZE = 14;

export default function AdminJobs() {
  const { toast } = useToast();
  const orders = useAsync(() => getOrders(), []);
  const analytics = useAsync(() => getPlatformAnalytics(), []);

  const [status, setStatus] = useState('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);

  const all = useMemo(() => orders.data ?? [], [orders.data]);

  const filtered = useMemo(
    () =>
      all.filter((order) => {
        if (status !== 'all' && order.status !== status) return false;
        if (query) {
          const haystack =
            `${order.id} ${order.shopName} ${order.machineId} ${order.customerName} ${order.documents?.[0]?.name ?? ''}`.toLowerCase();
          if (!haystack.includes(query.toLowerCase())) return false;
        }
        return true;
      }),
    [all, status, query],
  );

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const successRate = percent(
    all.filter((o) => o.status === ORDER_STATUS.COMPLETED).length,
    all.length,
  );

  const exportCsv = () => {
    const rows = [
      [
        'Order',
        'Created',
        'Shop',
        'Machine',
        'Customer',
        'Document',
        'Pages',
        'Copies',
        'Amount',
        'Fee',
        'Status',
      ],
      ...filtered.map((o) => [
        o.id,
        new Date(o.createdAt).toISOString(),
        o.shopName,
        o.machineId,
        o.customerName,
        o.documents?.[0]?.name ?? '',
        o.pageCount,
        o.copies,
        o.amount,
        o.platformFee ?? 0,
        o.status,
      ]),
    ];
    const csv = rows
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    downloadBlob(csv, 'smartprint-jobs.csv', 'text/csv');
    toast({
      type: 'success',
      title: 'Job report exported',
      description: `${filtered.length} rows`,
    });
  };

  const columns = [
    {
      key: 'id',
      header: 'Job',
      render: (row) => (
        <div>
          <p className="font-mono text-[12px] font-medium text-ink-900">{row.id}</p>
          <p className="text-[10.5px] text-ink-400">{timeAgo(row.createdAt)}</p>
        </div>
      ),
    },
    {
      key: 'shop',
      header: 'Shop / machine',
      hideBelow: 'sm',
      render: (row) => (
        <div className="max-w-[170px]">
          <p className="truncate text-[12px] text-ink-800">{row.shopName}</p>
          <p className="font-mono text-[10.5px] text-ink-400">{row.machineId}</p>
        </div>
      ),
    },
    {
      key: 'doc',
      header: 'Document',
      hideBelow: 'lg',
      render: (row) => (
        <div className="max-w-[190px]">
          <p className="truncate text-[12px] text-ink-700">{row.documents?.[0]?.name ?? '—'}</p>
          <p className="text-[10.5px] text-ink-400">
            {row.pageCount}p × {row.copies} · {row.color ? 'Colour' : 'B&W'} ·{' '}
            {row.sides === 'double' ? 'Duplex' : 'Single'}
          </p>
        </div>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      hideBelow: 'xl',
      render: (row) => <span className="text-[12px] text-ink-600">{row.customerName}</span>,
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
          <p className="text-[10px] text-ink-400">
            fee {formatCurrency(row.platformFee ?? 0, { decimals: 2 })}
          </p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <OrderStatusBadge status={row.status} size="sm" />,
    },
    {
      key: 'date',
      header: 'Placed',
      align: 'right',
      hideBelow: 'lg',
      render: (row) => (
        <span className="text-[11px] text-ink-400">{formatDateTime(row.createdAt)}</span>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Monitoring"
        title="Print job monitor"
        description={
          <span className="flex flex-wrap items-center gap-2">
            Every job across every shop, with revenue and fee breakdown. <MockBadge />
          </span>
        }
        actions={
          <>
            <Button
              variant="secondary"
              size="md"
              icon={RefreshCw}
              onClick={() => {
                orders.refetch();
                analytics.refetch();
              }}
            >
              Refresh
            </Button>
            <Button size="md" icon={Download} onClick={exportCsv}>
              Export
            </Button>
          </>
        }
      />

      {analytics.loading ? (
        <SkeletonStatGrid count={4} />
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            {
              label: 'Total jobs',
              value: all.length.toLocaleString('en-IN'),
              tone: 'text-ink-900',
            },
            {
              label: 'Completed',
              value: all
                .filter((o) => o.status === ORDER_STATUS.COMPLETED)
                .length.toLocaleString('en-IN'),
              tone: 'text-success',
            },
            {
              label: 'In flight',
              value: all
                .filter((o) =>
                  [ORDER_STATUS.PAID, ORDER_STATUS.QUEUED, ORDER_STATUS.PRINTING].includes(
                    o.status,
                  ),
                )
                .length.toLocaleString('en-IN'),
              tone: 'text-brand-600',
            },
            { label: 'Success rate', value: `${successRate}%`, tone: 'text-ink-900' },
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
      )}

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput
              value={query}
              onChange={(v) => {
                setQuery(v);
                setPage(1);
              }}
              placeholder="Search job, shop, machine or file…"
              className="w-full sm:w-72"
            />
            <div className="ml-auto flex items-center gap-2">
              <Badge tone="neutral" size="sm">
                {filtered.length} result{filtered.length === 1 ? '' : 's'}
              </Badge>
            </div>
          </div>
          <FilterTabs
            tabs={[
              { value: 'all', label: 'All', count: all.length },
              ...Object.values(ORDER_STATUS).map((s) => ({
                value: s,
                label: ORDER_STATUS_META[s].label,
                count: all.filter((o) => o.status === s).length,
              })),
            ]}
            value={status}
            onChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
          />
        </div>

        <DataTable
          columns={columns}
          rows={paged}
          loading={orders.loading}
          onRowClick={setSelected}
          empty={
            <div className="px-6 py-12 text-center">
              <SearchX className="mx-auto size-6 text-ink-300" />
              <p className="mt-3 text-[13.5px] font-medium text-ink-900">No jobs found</p>
              <p className="mt-1 text-[12.5px] text-ink-500">
                Try a different status or search term.
              </p>
            </div>
          }
        />
        <TablePagination
          page={currentPage}
          pageCount={pageCount}
          total={filtered.length}
          onPageChange={setPage}
        />
      </Card>

      <OrderDetailDrawer
        order={selected}
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        onChanged={() => orders.refetch()}
        showShop
      />
    </div>
  );
}
