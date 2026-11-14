import PageHeader from '../../components/ui/PageHeader.jsx';
import Card from '../../components/ui/Card.jsx';
import StatCard from '../../components/ui/StatCard.jsx';
import BarChart from '../../components/charts/BarChart.jsx';
import { db } from '../../services/db.js';

export default function ShopRevenue() {
  const shop = db.shops[0];
  const orders = db.orders.filter((o) => o.shopId === shop?.id);

  const totalRevenue = orders.reduce((sum, o) => sum + (o.totalPaise || 0), 0);
  const totalOrders = orders.length;
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const completedOrders = orders.filter((o) => o.status === 'completed').length;

  // Revenue by day (last 7 days)
  const revenueByDay = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const label = d.toLocaleDateString('en-IN', { weekday: 'short' });
    const dayOrders = orders.filter((o) => {
      const orderDate = new Date(o.createdAt);
      return orderDate.toDateString() === d.toDateString();
    });
    const dayRevenue = dayOrders.reduce((sum, o) => sum + (o.totalPaise || 0), 0);
    revenueByDay.push({ label, value: dayRevenue / 100 });
  }

  // Revenue by machine
  const machineRevenue = {};
  orders.forEach((o) => {
    const key = o.machineId || 'Unknown';
    machineRevenue[key] = (machineRevenue[key] || 0) + (o.totalPaise || 0);
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Revenue reports"
        description="Earnings overview and breakdowns for your shop."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total revenue" value={`₹${(totalRevenue / 100).toFixed(0)}`} tone="brand" />
        <StatCard label="Total orders" value={totalOrders.toString()} />
        <StatCard label="Avg. order value" value={`₹${(avgOrderValue / 100).toFixed(0)}`} />
        <StatCard label="Completed" value={completedOrders.toString()} tone="success" />
      </div>

      <Card>
        <h3 className="mb-4 text-[14px] font-semibold text-ink-900">Revenue — Last 7 days</h3>
        <BarChart data={revenueByDay} height={200} />
      </Card>

      <Card>
        <h3 className="mb-4 text-[14px] font-semibold text-ink-900">Revenue by machine</h3>
        <div className="space-y-3">
          {Object.entries(machineRevenue).map(([machineId, revenue]) => (
            <div key={machineId} className="flex items-center justify-between rounded-md border border-line px-4 py-3">
              <div>
                <p className="text-[13px] font-medium text-ink-900">{machineId}</p>
                <p className="text-[12px] text-ink-500">
                  {orders.filter((o) => (o.machineId || 'Unknown') === machineId).length} orders
                </p>
              </div>
              <p className="text-[14px] font-semibold text-ink-900 tabular-nums">
                ₹{(revenue / 100).toFixed(0)}
              </p>
            </div>
          ))}
          {Object.keys(machineRevenue).length === 0 && (
            <p className="py-8 text-center text-[13px] text-ink-400">No revenue data yet.</p>
          )}
        </div>
      </Card>
    </div>
  );
}
