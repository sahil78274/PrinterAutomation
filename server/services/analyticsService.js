import ApiError from '../utils/ApiError.js';
import { getRepository } from '../repositories/active.js';

/**
 * Analytics.
 *
 * Every number here is computed from stored orders, jobs, machines and payments
 * on each request. Nothing is hardcoded, seeded, or estimated — a dashboard that
 * shows invented revenue is worse than one showing zero.
 *
 * Money is summed in integer paise and only formatted at the edge, so totals
 * never drift by rounding.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Start of the local day, `daysAgo` days before today. */
function dayStart(daysAgo, now = new Date()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - daysAgo);
  return start;
}

function isoDay(date) {
  return date.toISOString().slice(0, 10);
}

function withinRange(iso, from, to) {
  const time = new Date(iso).getTime();
  return time >= from.getTime() && time <= to.getTime();
}

/**
 * Only paid orders count as revenue.
 *
 * A failed or abandoned payment must never appear in turnover — that is the
 * difference between a shop that looks busy and a shop that is solvent.
 */
function isRevenueOrder(order) {
  return (
    order.status === 'paid' || order.status === 'completed' || order.paymentStatus === 'succeeded'
  );
}

/**
 * Split a set of orders into real and simulated revenue, in paise.
 *
 * Simulated (development-provider) payments are counted, but reported
 * separately. Excluding them outright would leave every dashboard at zero and
 * hide whether analytics work at all; including them silently would present
 * fake money as takings. Splitting is the only truthful, useful option — and
 * every response states which portion is simulated.
 */
function splitRevenue(orders) {
  let realPaise = 0;
  let simulatedPaise = 0;

  for (const order of orders) {
    const amount = order.totals?.totalPaise ?? 0;
    if (order.simulated === true) simulatedPaise += amount;
    else realPaise += amount;
  }

  return {
    realPaise,
    simulatedPaise,
    totalPaise: realPaise + simulatedPaise,
    entirelySimulated: realPaise === 0 && simulatedPaise > 0,
  };
}

/**
 * Shop dashboard summary.
 *
 * @param {string} shopId
 * @param {{ days?: number }} options
 */
export async function shopSummary(shopId, { days = 30 } = {}) {
  if (!shopId) throw ApiError.badRequest('A shop is required', { code: 'SHOP_REQUIRED' });

  const repo = getRepository();
  const now = new Date();
  const windowStart = dayStart(days - 1, now);

  const [orders, jobs, machines, payments] = await Promise.all([
    repo.findAll('printOrders', { shopId }),
    repo.findAll('printJobs', { shopId }),
    repo.findAll('machines', { shopId }),
    repo.findAll('paymentAttempts', { shopId }),
  ]);

  const inWindow = orders.filter(
    (order) => withinRange(order.createdAt, windowStart, now) && isRevenueOrder(order),
  );

  const revenueSplit = splitRevenue(inWindow);
  const revenuePaise = revenueSplit.totalPaise;
  const platformFeePaise = inWindow.reduce(
    (sum, order) => sum + (order.totals?.platformFeePaise ?? 0),
    0,
  );
  const sheetsPrinted = inWindow.reduce((sum, order) => sum + (order.sheetCount ?? 0), 0);

  // Daily series, explicitly zero-filled so the chart cannot imply missing days.
  const daily = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const start = dayStart(offset, now);
    const end = new Date(start);
    end.setHours(23, 59, 59, 999);

    const dayOrders = inWindow.filter((order) => withinRange(order.createdAt, start, end));
    const daySplit = splitRevenue(dayOrders);

    daily.push({
      date: isoDay(start),
      orders: dayOrders.length,
      revenuePaise: daySplit.totalPaise,
      simulatedPaise: daySplit.simulatedPaise,
      sheets: dayOrders.reduce((sum, o) => sum + (o.sheetCount ?? 0), 0),
    });
  }

  const ordersByStatus = orders.reduce((counts, order) => {
    counts[order.status] = (counts[order.status] ?? 0) + 1;
    return counts;
  }, {});

  const jobsByStatus = jobs.reduce((counts, job) => {
    counts[job.status] = (counts[job.status] ?? 0) + 1;
    return counts;
  }, {});

  const failedJobs = jobsByStatus.FAILED ?? 0;
  const completedJobs = jobsByStatus.COMPLETED ?? 0;
  const totalFinished = failedJobs + completedJobs;

  const successfulPayments = payments.filter((p) => p.status === 'succeeded');

  return {
    range: { from: windowStart.toISOString(), to: now.toISOString(), days },
    // Stated explicitly so a dashboard built on simulated payments cannot
    // accidentally present them as real takings.
    simulated: true,
    revenue: {
      grossPaise: revenuePaise,
      platformFeePaise,
      // What the shop actually keeps.
      netPaise: revenuePaise - platformFeePaise,
      orderCount: inWindow.length,
      averageOrderPaise: inWindow.length ? Math.round(revenuePaise / inWindow.length) : 0,
      // The honest breakdown: a dashboard must show this, not just the total.
      simulatedPaise: revenueSplit.simulatedPaise,
      realPaise: revenueSplit.realPaise,
      entirelySimulated: revenueSplit.entirelySimulated,
    },
    volume: {
      sheets: sheetsPrinted,
      pages: inWindow.reduce((sum, order) => sum + (order.pageCount ?? 0) * (order.copies ?? 1), 0),
      orders: orders.length,
      jobs: jobs.length,
    },
    printing: {
      completed: completedJobs,
      failed: failedJobs,
      // null rather than 0 when nothing has finished: a 0% success rate would
      // be a lie in the other direction.
      successRatePercent: totalFinished
        ? Math.round((completedJobs / totalFinished) * 1000) / 10
        : null,
    },
    payments: {
      attempts: payments.length,
      succeeded: successfulPayments.length,
      failed: payments.filter((p) => p.status === 'failed').length,
      collectedPaise: successfulPayments.reduce((sum, p) => sum + (p.amountPaise ?? 0), 0),
    },
    machines: {
      total: machines.length,
      online: machines.filter((m) => m.status === 'online').length,
      offline: machines.filter((m) => m.status === 'offline').length,
      maintenance: machines.filter((m) => m.status === 'maintenance').length,
    },
    ordersByStatus,
    jobsByStatus,
    daily,
  };
}

/** Fleet view for a shop: per-machine throughput. */
export async function machineBreakdown(shopId, { days = 30 } = {}) {
  const repo = getRepository();
  const now = new Date();
  const windowStart = dayStart(days - 1, now);

  const [machines, jobs] = await Promise.all([
    repo.findAll('machines', { shopId }, { sort: { machineId: 1 } }),
    repo.findAll('printJobs', { shopId }),
  ]);

  return machines.map((machine) => {
    const machineJobs = jobs.filter(
      (job) => job.machineId === machine.machineId && withinRange(job.createdAt, windowStart, now),
    );
    const completed = machineJobs.filter((job) => job.status === 'COMPLETED').length;
    const failed = machineJobs.filter((job) => job.status === 'FAILED').length;

    return {
      machineId: machine.machineId,
      name: machine.name,
      status: machine.status,
      jobs: machineJobs.length,
      completed,
      failed,
      successRatePercent:
        completed + failed ? Math.round((completed / (completed + failed)) * 1000) / 10 : null,
    };
  });
}

/**
 * Platform-wide view for the super admin.
 *
 * Cross-tenant by definition, so it is admin-only at the route. Revenue counts
 * only paid orders, same rule as the shop summary.
 */
export async function platformSummary({ days = 30 } = {}) {
  const repo = getRepository();
  const now = new Date();
  const windowStart = dayStart(days - 1, now);

  const [shops, orders, jobs, machines, users, agents] = await Promise.all([
    repo.findAll('shops', {}),
    repo.findAll('printOrders', {}),
    repo.findAll('printJobs', {}),
    repo.findAll('machines', {}),
    repo.findAll('users', {}),
    repo.findAll('printAgents', {}),
  ]);

  const revenueOrders = orders.filter(
    (order) => withinRange(order.createdAt, windowStart, now) && isRevenueOrder(order),
  );

  const platformSplit = splitRevenue(revenueOrders);
  const grossPaise = platformSplit.totalPaise;
  const feePaise = revenueOrders.reduce((sum, o) => sum + (o.totals?.platformFeePaise ?? 0), 0);

  // Per-shop revenue, highest first — the table an admin actually wants.
  const perShop = shops
    .map((shop) => {
      const shopOrders = revenueOrders.filter((order) => order.shopId === shop.id);
      return {
        shopId: shop.id,
        shopCode: shop.shopCode,
        name: shop.name,
        status: shop.status,
        planId: shop.planId,
        orders: shopOrders.length,
        revenuePaise: shopOrders.reduce((sum, o) => sum + (o.totals?.totalPaise ?? 0), 0),
        machines: machines.filter((m) => m.shopId === shop.id).length,
      };
    })
    .sort((a, b) => b.revenuePaise - a.revenuePaise);

  return {
    range: { from: windowStart.toISOString(), to: now.toISOString(), days },
    simulated: true,
    shops: {
      total: shops.length,
      active: shops.filter((s) => s.status === 'active').length,
      pending: shops.filter((s) => s.status === 'pending').length,
      suspended: shops.filter((s) => s.status === 'suspended').length,
    },
    users: {
      total: users.length,
      admins: users.filter((u) => u.role === 'admin').length,
      owners: users.filter((u) => u.role === 'owner').length,
      staff: users.filter((u) => u.role === 'staff').length,
    },
    machines: {
      total: machines.length,
      online: machines.filter((m) => m.status === 'online').length,
      agentsPaired: agents.length,
    },
    revenue: {
      grossPaise,
      platformFeePaise: feePaise,
      shopPayoutPaise: grossPaise - feePaise,
      paidOrders: revenueOrders.length,
      simulatedPaise: platformSplit.simulatedPaise,
      realPaise: platformSplit.realPaise,
      entirelySimulated: platformSplit.entirelySimulated,
    },
    jobs: {
      total: jobs.length,
      completed: jobs.filter((j) => j.status === 'COMPLETED').length,
      failed: jobs.filter((j) => j.status === 'FAILED').length,
    },
    perShop,
  };
}

/**
 * A printable CSV of a shop's orders for a date range.
 *
 * Escaping is done here rather than by string concatenation at the call site:
 * a customer's filename containing a comma or a quote must not corrupt the file.
 */
export async function ordersCsv(shopId, { days = 30 } = {}) {
  const repo = getRepository();
  const now = new Date();
  const windowStart = dayStart(days - 1, now);

  const orders = await repo.findAll('printOrders', { shopId }, { sort: { createdAt: -1 } });
  const inRange = orders.filter((order) => withinRange(order.createdAt, windowStart, now));

  const escape = (value) => {
    const text = value === null || value === undefined ? '' : String(value);
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };

  const header = [
    'Order ID',
    'Created',
    'Machine',
    'Document',
    'Pages',
    'Copies',
    'Colour',
    'Sides',
    'Paper',
    'Sheets',
    'Subtotal (INR)',
    'Platform fee (INR)',
    'Total (INR)',
    'Status',
    'Simulated',
  ];

  const rows = inRange.map((order) => [
    order.id,
    order.createdAt,
    order.machineId,
    order.documentName,
    order.pageCount,
    order.copies,
    order.color,
    order.sides,
    order.paperSize,
    order.sheetCount,
    ((order.totals?.subtotalPaise ?? 0) / 100).toFixed(2),
    ((order.totals?.platformFeePaise ?? 0) / 100).toFixed(2),
    ((order.totals?.totalPaise ?? 0) / 100).toFixed(2),
    order.status,
    order.simulated === true ? 'yes' : 'no',
  ]);

  return [header, ...rows].map((row) => row.map(escape).join(',')).join('\r\n');
}

export default {
  machineBreakdown,
  ordersCsv,
  platformSummary,
  shopSummary,
};
