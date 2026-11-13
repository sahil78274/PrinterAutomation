import { useMemo, useState } from 'react';
import { Download, FileSearch, RefreshCw } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Card from '../../components/ui/Card.jsx';
import DataTable, { TablePagination } from '../../components/ui/DataTable.jsx';
import Button from '../../components/ui/Button.jsx';
import { OrderStatusBadge } from '../../components/orders/OrderStatusBadge.jsx';
import OrderDetailDrawer from '../../components/orders/OrderDetailDrawer.jsx';
import { FilterSelect, FilterTabs, SearchInput } from '../../components/ui/FilterBar.jsx';
import { MockBadge } from '../../components/ui/MockNotice.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { getMachines, getOrders } from '../../services/api.js';
import { ORDER_STATUS, ORDER_STATUS_META } from '../../lib/constants.js';
import { downloadBlob, formatCurrency, formatDateTime, timeAgo } from '../../lib/utils.js';
import { useToast } from '../../context/ToastContext.jsx';

const PAGE_SIZE = 12;

export default function ShopOrders() {
  const { user } = useAuth();
  const { toast } = useToast();
  const shopId = user?.shopId;

  const orders = useAsync(() => getOrders({ shopId }), [shopId]);
  const machines = useAsync(() => getMachines({ shopId }), [shopId]);

  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [machineId, setMachineId] = useState('all');
  const [range, setRange] = useState('30');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);

  const all = useMemo(() => orders.data ?? [], [orders.data]);

  const filtered = useMemo(() => {
    const cutoff = range === 'all' ? 0 : Date.now() - Number(range) * 86400000;
    return all.filter((order) => {
      if (status !== 'all' && order.status !== status) return false;
      if (machineId !== 'all' && order.machineId !== machineId) return false;
      if (cutoff && new Date(order.createdAt).getTime() < cutoff) return false;
      if (query) {
        const haystack =
          `${order.id} ${order.customerName} ${order.machineId} ${order.documents?.[0]?.name ?? ''}`.toLowerCase();
        if (!haystack.includes(query.toLowerCase())) return false;
      }
      return true;
    });
  }, [all, status, machineId, range, query]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const statusTabs = [
    { value: 'all', label: 'All', count: all.length },
    ...Object.values(ORDER_STATUS)
      .filter((s) => s !== ORDER_STATUS.AWAITING_PAYMENT)
      .map((s) => ({
        value: s,
        label: ORDER_STATUS_META[s].label,
        count: all.filter((o) => o.status === s).length,
      })),
  ];

  const exportCsv = () => {
    const header = [
      'Order ID',
      'Date',
      'Machine',
      'Customer',
      'Document',
      'Pages',
      'Copies',
      'Amount',
      'Status',
      'Payment',
    ];
    const rows = filtered.map((o) => [
      o.id,
      new Date(o.createdAt).toISOString(),
      o.machineId,
      o.customerName,
      o.documents?.[0]?.name ?? '',
      o.pageCount,
      o.copies,
      o.amount,
      o.status,
      o.paymentMethod ?? '',
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    downloadBlob(csv, `smartprint-orders-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv');
    toast({
      type: 'success',
      title: 'Export ready',
      description: `${filtered.length} orders exported as CSV.`,
    });
  };

  const columns = [
    {
      key: 'id',
      header: 'Order',
      render: (row) => (
        <div className="min-w-[86px]">
          <p className="font-mono text-[12px] font-medium text-ink-900">{row.id}</p>
          <p className="text-[10.5px] text-ink-400">{timeAgo(row.createdAt)}</p>
        </div>
      ),
    },
    {
      key: 'document',
      header: 'Document',
      hideBelow: 'md',
      render: (row) => (
        <div className="max-w-[220px]">
          <p className="truncate text-[12.5px] text-ink-800">{row.documents?.[0]?.name ?? '—'}</p>
          <p className="text-[11px] text-ink-400">
            {row.pageCount} pages · {row.copies}× · {row.color ? 'Colour' : 'B&W'} ·{' '}
            {row.sides === 'double' ? 'Duplex' : 'Single'}
          </p>
        </div>
      ),
    },
    {
      key: 'machine',
      header: 'Machine',
      hideBelow: 'sm',
      render: (row) => (
        <div>
          <p className="font-mono text-[11.5px] text-ink-700">{row.machineId}</p>
          <p className="truncate text-[11px] text-ink-400">{row.machineName}</p>
        </div>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      hideBelow: 'lg',
      render: (row) => <span className="text-[12.5px] text-ink-700">{row.customerName}</span>,
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
          <p className="text-[10.5px] text-ink-400">{row.paymentMethod ?? 'unpaid'}</p>
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
      hideBelow: 'xl',
      render: (row) => (
        <span className="text-[11.5px] text-ink-400">{formatDateTime(row.createdAt)}</span>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Print job history"
        eyebrow="Orders"
        description={
          <span className="flex flex-wrap items-center gap-2">
            Every job across your machines, with payment and document details. <MockBadge />
          </span>
        }
        actions={
          <>
            <Button variant="secondary" size="md" icon={RefreshCw} onClick={() => orders.refetch()}>
              Refresh
            </Button>
            <Button size="md" icon={Download} onClick={exportCsv}>
              Export CSV
            </Button>
          </>
        }
      />

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput
              value={query}
              onChange={(v) => {
                setQuery(v);
                setPage(1);
              }}
              placeholder="Search order ID, customer or file…"
              className="w-full sm:w-64"
            />
            <FilterSelect
              value={machineId}
              onChange={(v) => {
                setMachineId(v);
                setPage(1);
              }}
              label="Filter by machine"
              options={[
                { value: 'all', label: 'All machines' },
                ...(machines.data ?? []).map((m) => ({
                  value: m.id,
                  label: `${m.id} · ${m.name}`,
                })),
              ]}
              className="w-full sm:w-44"
            />
            <FilterSelect
              value={range}
              onChange={(v) => {
                setRange(v);
                setPage(1);
              }}
              label="Date range"
              options={[
                { value: '7', label: 'Last 7 days' },
                { value: '30', label: 'Last 30 days' },
                { value: 'all', label: 'All time' },
              ]}
              className="w-full sm:w-36"
            />
            <span className="ml-auto hidden text-[12px] text-ink-400 sm:block">
              {filtered.length} job{filtered.length === 1 ? '' : 's'}
            </span>
          </div>

          <FilterTabs
            tabs={statusTabs}
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
              <span className="mx-auto grid size-11 place-items-center rounded-xl border border-line bg-surface-muted text-ink-400">
                <FileSearch className="size-4" />
              </span>
              <p className="mt-3 text-[13.5px] font-medium text-ink-900">
                No jobs match these filters
              </p>
              <p className="mt-1 text-[12.5px] text-ink-500">
                Try widening the date range or clearing the search.
              </p>
              <Button
                className="mt-3"
                size="sm"
                variant="secondary"
                onClick={() => {
                  setQuery('');
                  setStatus('all');
                  setMachineId('all');
                  setRange('all');
                }}
              >
                Clear filters
              </Button>
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
      />
    </div>
  );
}
