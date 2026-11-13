import { useMemo, useState } from 'react';
import {
  Building2,
  ExternalLink,
  MapPin,
  Phone,
  Plus,
  RefreshCw,
  Store,
  TriangleAlert,
} from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import Badge from '../../components/ui/Badge.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import Modal, { ModalBody, ModalFooter, ModalHeader } from '../../components/ui/Modal.jsx';
import { FilterSelect, FilterTabs, SearchInput } from '../../components/ui/FilterBar.jsx';
import { MockBadge, MockNotice } from '../../components/ui/MockNotice.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { changePlan, getShops } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { PLAN_CATALOG } from '../../lib/constants.js';
import { formatCurrency, formatDate, formatNumber } from '../../lib/utils.js';

export default function AdminShops() {
  const { toast } = useToast();
  const shops = useAsync(() => getShops(), []);
  const [query, setQuery] = useState('');
  const [plan, setPlan] = useState('all');
  const [health, setHealth] = useState('all');
  const [selected, setSelected] = useState(null);
  const [busyPlan, setBusyPlan] = useState(null);

  const list = useMemo(() => shops.data ?? [], [shops.data]);

  const filtered = useMemo(
    () =>
      list.filter((shop) => {
        if (plan !== 'all' && shop.planId !== plan) return false;
        if (health === 'past_due' && shop.planStatus !== 'past_due') return false;
        if (health === 'offline' && shop.onlineMachines > 0) return false;
        if (health === 'healthy' && (shop.onlineMachines === 0 || shop.planStatus === 'past_due'))
          return false;
        if (query) {
          const haystack =
            `${shop.name} ${shop.city} ${shop.ownerName} ${shop.email} ${shop.id}`.toLowerCase();
          if (!haystack.includes(query.toLowerCase())) return false;
        }
        return true;
      }),
    [list, plan, health, query],
  );

  const totals = {
    shops: list.length,
    machines: list.reduce((sum, s) => sum + s.machineCount, 0),
    revenue: list.reduce((sum, s) => sum + s.revenue, 0),
    pastDue: list.filter((s) => s.planStatus === 'past_due').length,
  };

  const setShopPlan = async (shopId, planId) => {
    setBusyPlan(shopId);
    try {
      await changePlan(shopId, planId);
      toast({
        type: 'success',
        title: 'Plan updated',
        description: 'Simulated — no billing triggered.',
      });
      shops.refetch();
    } catch (error) {
      toast({ type: 'error', title: 'Failed', description: error.message });
    } finally {
      setBusyPlan(null);
    }
  };

  const columns = [
    {
      key: 'name',
      header: 'Shop',
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600">
            <Store className="size-3.5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[12.5px] font-medium text-ink-900">{row.name}</p>
            <p className="font-mono text-[10.5px] text-ink-400">{row.id}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'owner',
      header: 'Owner',
      hideBelow: 'lg',
      render: (row) => (
        <div>
          <p className="text-[12px] text-ink-700">{row.ownerName}</p>
          <p className="text-[10.5px] text-ink-400">{row.phone}</p>
        </div>
      ),
    },
    {
      key: 'city',
      header: 'Location',
      hideBelow: 'sm',
      render: (row) => (
        <span className="inline-flex items-center gap-1 text-[12px] text-ink-600">
          <MapPin className="size-3 text-ink-400" />
          {row.city}
        </span>
      ),
    },
    {
      key: 'machines',
      header: 'Machines',
      align: 'right',
      render: (row) => (
        <div>
          <p className="tabular-nums text-[12.5px] text-ink-900">
            {row.onlineMachines}/{row.machineCount}
          </p>
          <p className="text-[10px] text-ink-400">online</p>
        </div>
      ),
    },
    {
      key: 'orders',
      header: 'Orders',
      align: 'right',
      hideBelow: 'md',
      render: (row) => (
        <span className="tabular-nums text-[12.5px] text-ink-700">
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
    {
      key: 'plan',
      header: 'Plan',
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
      key: 'since',
      header: 'Joined',
      align: 'right',
      hideBelow: 'xl',
      render: (row) => <span className="text-[11px] text-ink-400">{formatDate(row.joinedOn)}</span>,
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Tenants"
        title="Shop management"
        description={
          <span className="flex flex-wrap items-center gap-2">
            Every independent print shop operating on the platform. <MockBadge />
          </span>
        }
        actions={
          <>
            <Button variant="secondary" size="md" icon={RefreshCw} onClick={() => shops.refetch()}>
              Refresh
            </Button>
            <Button
              size="md"
              icon={Plus}
              onClick={() =>
                toast({
                  type: 'info',
                  title: 'Onboarding flow',
                  description:
                    'Shop onboarding is handled via the signup form on the marketing site.',
                })
              }
            >
              Invite shop
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Total shops', value: formatNumber(totals.shops), tone: 'text-ink-900' },
          { label: 'Machines', value: formatNumber(totals.machines), tone: 'text-ink-900' },
          {
            label: 'Network revenue',
            value: formatCurrency(totals.revenue, { compact: true }),
            tone: 'text-success',
          },
          { label: 'Past due', value: totals.pastDue, tone: 'text-danger' },
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

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="Search shop, owner, city…"
              className="w-full sm:w-64"
            />
            <FilterSelect
              value={plan}
              onChange={setPlan}
              label="Filter by plan"
              options={[
                { value: 'all', label: 'All plans' },
                ...PLAN_CATALOG.map((p) => ({ value: p.id, label: p.name })),
              ]}
              className="w-full sm:w-40"
            />
            <span className="ml-auto hidden text-[12px] text-ink-400 sm:block">
              {filtered.length} shop{filtered.length === 1 ? '' : 's'}
            </span>
          </div>
          <FilterTabs
            tabs={[
              { value: 'all', label: 'All', count: list.length },
              {
                value: 'healthy',
                label: 'Healthy',
                count: list.filter((s) => s.onlineMachines > 0 && s.planStatus !== 'past_due')
                  .length,
              },
              { value: 'past_due', label: 'Billing issue', count: totals.pastDue },
              {
                value: 'offline',
                label: 'No machines online',
                count: list.filter((s) => s.onlineMachines === 0).length,
              },
            ]}
            value={health}
            onChange={setHealth}
          />
        </div>

        <DataTable
          columns={columns}
          rows={filtered}
          loading={shops.loading}
          onRowClick={setSelected}
        />
      </Card>

      <MockNotice tone="neutral" icon={Building2} title="Multi-tenant by design">
        Shops are fully isolated: a shop owner token can only read and write records scoped to their
        own shopId. The admin token is the only one allowed to list across tenants.
      </MockNotice>

      <ShopDetailModal
        shop={selected}
        onClose={() => setSelected(null)}
        onChangePlan={setShopPlan}
        busyPlan={busyPlan}
      />
    </div>
  );
}

function ShopDetailModal({ shop, onClose, onChangePlan, busyPlan }) {
  if (!shop) return null;
  return (
    <Modal open onClose={onClose} labelledBy="shop-detail-title" className="sm:max-w-xl">
      <ModalHeader
        id="shop-detail-title"
        title={shop.name}
        description={`${shop.id} · joined ${formatDate(shop.joinedOn)}`}
        icon={Store}
        onClose={onClose}
      />
      <ModalBody className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Machines', value: `${shop.onlineMachines}/${shop.machineCount}` },
            { label: 'Orders', value: formatNumber(shop.totalOrders) },
            { label: 'Revenue', value: formatCurrency(shop.revenue, { compact: true }) },
          ].map((stat) => (
            <div key={stat.label} className="rounded-lg border border-line bg-surface-muted/50 p-3">
              <p className="text-[10.5px] uppercase tracking-[0.06em] text-ink-400">{stat.label}</p>
              <p className="mt-0.5 text-[16px] font-semibold tabular-nums text-ink-900">
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        <dl className="divide-y divide-line rounded-lg border border-line text-[12px]">
          {[
            ['Owner', shop.ownerName],
            ['Email', shop.email],
            ['Phone', shop.phone],
            ['GSTIN', shop.gstin],
            ['Address', shop.address],
            ['Open hours', shop.openHours],
            ['Payout', `${shop.payout.method} · ${shop.payout.handle}`],
            ['Rating', `${shop.rating} ★ (${shop.reviews})`],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4 px-3.5 py-2.5">
              <dt className="shrink-0 text-ink-500">{label}</dt>
              <dd className="min-w-0 truncate text-right font-medium text-ink-900">{value}</dd>
            </div>
          ))}
        </dl>

        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-400">
            Subscription plan
          </p>
          <div className="flex flex-wrap gap-2">
            {PLAN_CATALOG.map((p) => (
              <Button
                key={p.id}
                size="sm"
                variant={shop.planId === p.id ? 'primary' : 'secondary'}
                loading={busyPlan === shop.id}
                disabled={shop.planId === p.id}
                onClick={() => onChangePlan(shop.id, p.id)}
              >
                {p.name}
              </Button>
            ))}
          </div>
        </div>

        {shop.planStatus === 'past_due' ? (
          <MockNotice tone="warn" icon={TriangleAlert} title="Billing issue">
            This shop has an outstanding invoice. New customer orders are paused until it is
            cleared.
          </MockNotice>
        ) : null}

        <MockNotice tone="neutral" icon={Phone}>
          Contact details are sample data. Real shop records will come from the MongoDB `shops`
          collection with KYC verification.
        </MockNotice>
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" size="sm" onClick={onClose}>
          Close
        </Button>
        <Button size="sm" icon={ExternalLink} to={`/admin/machines?shop=${shop.id}`}>
          View machines
        </Button>
      </ModalFooter>
    </Modal>
  );
}
