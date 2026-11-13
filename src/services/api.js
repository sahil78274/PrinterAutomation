import { db, emitChange } from './db.js';
import { DEMO_ACCOUNTS, ORDER_STATUS } from '../lib/constants.js';
import apiClient from './apiClient.js';

/**
 * Service layer.
 *
 * Two implementations live side by side on purpose:
 *
 *  1. A mock, seeded in the browser (src/data/seed.js). It is the default, so
 *     the demo works with no backend, no database and no credentials.
 *  2. Calls to the real Express API, enabled per endpoint by VITE_API_BASE_URL
 *     plus the LIVE_ENDPOINTS allowlist below.
 *
 * Only endpoints the backend actually implements today (health, machines,
 * shops) are wired for live use. Everything else keeps its documented REST
 * equivalent in the comment above it and returns mock data — swapping in the
 * live call later is a one-line change here, with no UI churn.
 *
 * The mock bodies are unchanged and still exported indirectly through these
 * wrappers, so scripts/flow-test.mjs keeps exercising the real preview flows.
 */

const delay = (ms = 320) => new Promise((resolve) => setTimeout(resolve, ms));

function notFound(message) {
  const error = new Error(message);
  error.status = 404;
  return error;
}

/* ----------------------------------------------------------- live switch --- */

/** Live mode is opt-in: no base URL means the whole app runs on the mock. */
export const isLiveMode = Boolean(import.meta.env?.VITE_API_BASE_URL);

/**
 * Endpoints with a real, implemented server counterpart.
 *
 * Kept as an explicit list rather than "live mode means all live" because a
 * half-built backend would otherwise break working demo screens. Add a key here
 * only once the route exists and is tested on the server.
 */
const LIVE_ENDPOINTS = new Set([
  'getShops',
  'getShop',
  'getMachines',
  'getMachine',
  'createMachine',
]);

function hasLive(name) {
  return isLiveMode && LIVE_ENDPOINTS.has(name);
}

/**
 * Run the live implementation when enabled, otherwise the mock.
 *
 * The fallback is deliberately narrow: it only covers *transport* failures
 * (server down, DNS, timeout). A 4xx from the API is a real answer and is
 * rethrown, because silently serving invented data after a validation error
 * would hide bugs in both layers.
 */
async function withLive(name, liveFn, mockFn) {
  if (!hasLive(name)) return mockFn();

  try {
    return await liveFn();
  } catch (error) {
    if (error?.name === 'ApiClientError' && error.status === 0) {
      // eslint-disable-next-line no-console
      console.warn(`[api] ${name}: ${error.message} — falling back to mock data.`);
      return mockFn();
    }
    throw error;
  }
}

/* ------------------------------------------------------------------ auth --- */

// POST /api/auth/login
export async function login({ email, password }) {
  await delay(560);
  const account = DEMO_ACCOUNTS.find(
    (a) => a.email.toLowerCase() === String(email).toLowerCase().trim(),
  );
  if (!account) throw new Error('No account found for that email address.');
  if (account.password !== password) throw new Error('Incorrect password. Please try again.');

  const shop = account.shopId ? db.shops.find((s) => s.id === account.shopId) : null;
  return {
    token: `mock_jwt_${account.role}_${Date.now()}`,
    user: {
      id: account.id,
      role: account.role,
      name: account.name,
      email: account.email,
      title: account.title,
      shopId: account.shopId,
      shopName: account.shopName,
      shop: shop ?? null,
    },
  };
}

// GET /api/auth/me
export async function me(token) {
  await delay(200);
  if (!token) throw new Error('Unauthenticated');
  const role = token.split('_')[2];
  const account = DEMO_ACCOUNTS.find((a) => a.role === role);
  return account ? { role: account.role, name: account.name } : null;
}

/* ----------------------------------------------------------------- shops --- */

// GET /api/shops
export async function getShops() {
  return withLive(
    'getShops',
    () => apiClient.get('/api/shops'),
    () => getShops_mock(),
  );
}

/** Mock implementation — see the live wiring above. */
async function getShops_mock() {
  await delay(280);
  return db.shops.map((shop) => {
    const machines = db.machines.filter((m) => m.shopId === shop.id);
    const orders = db.orders.filter((o) => o.shopId === shop.id);
    return {
      ...shop,
      machineCount: machines.length,
      onlineMachines: machines.filter((m) => m.status === 'online' || m.status === 'busy').length,
      totalOrders: orders.length,
      revenue: orders
        .filter((o) => o.paymentStatus === 'success')
        .reduce((sum, o) => sum + o.amount, 0),
    };
  });
}

// GET /api/shops/:id
export async function getShop(shopId) {
  return withLive(
    'getShop',
    () => apiClient.get(`/api/shops/${encodeURIComponent(shopId)}`),
    () => getShop_mock(shopId),
  );
}

/** Mock implementation — see the live wiring above. */
async function getShop_mock(shopId) {
  await delay(240);
  const shop = db.shops.find((s) => s.id === shopId);
  if (!shop) throw notFound('Shop not found');
  return { ...shop };
}

// PATCH /api/shops/:id
export async function updateShop(shopId, patch) {
  await delay(480);
  const index = db.shops.findIndex((s) => s.id === shopId);
  if (index === -1) throw notFound('Shop not found');
  db.shops[index] = { ...db.shops[index], ...patch };
  emitChange();
  return { ...db.shops[index] };
}

// PATCH /api/shops/:id/settings
export async function updateShopSettings(shopId, settings) {
  await delay(420);
  const shop = db.shops.find((s) => s.id === shopId);
  if (!shop) throw notFound('Shop not found');
  shop.settings = { ...shop.settings, ...settings };
  emitChange();
  return { ...shop };
}

/* -------------------------------------------------------------- machines --- */

// GET /api/machines?shopId=
export async function getMachines({ shopId } = {}) {
  return withLive(
    'getMachines',
    () => apiClient.get('/api/machines', { query: { shopId } }),
    () => getMachines_mock({ shopId }),
  );
}

/** Mock implementation — see the live wiring above. */
async function getMachines_mock({ shopId } = {}) {
  await delay(300);
  const list = shopId ? db.machines.filter((m) => m.shopId === shopId) : db.machines;
  return list.map((m) => ({ ...m }));
}

// GET /api/machines/:machineId  (public — used by the QR portal)
export async function getMachine(machineId) {
  return withLive(
    'getMachine',
    () => apiClient.get(`/api/machines/${encodeURIComponent(machineId)}`),
    () => getMachine_mock(machineId),
  );
}

/** Mock implementation — see the live wiring above. */
async function getMachine_mock(machineId) {
  await delay(380);
  const machine = db.machines.find((m) => m.id.toLowerCase() === String(machineId).toLowerCase());
  if (!machine) throw notFound(`Machine ${machineId} is not registered on SmartPrint.`);
  const shop = db.shops.find((s) => s.id === machine.shopId);
  return {
    ...machine,
    shop: shop
      ? {
          id: shop.id,
          name: shop.name,
          address: shop.address,
          phone: shop.phone,
          openHours: shop.openHours,
          rating: shop.rating,
          reviews: shop.reviews,
          settings: shop.settings,
          acceptOrders: shop.settings.acceptOrders && shop.planStatus !== 'past_due',
        }
      : null,
  };
}

// POST /api/machines
export async function createMachine(params) {
  const { shopId, name, model, supportsColor, supportsDuplex } = params;
  return withLive(
    'createMachine',
    () => createMachineLive({ shopId, name, model, supportsColor, supportsDuplex }),
    () => createMachine_mock(params),
  );
}

/**
 * The server owns machine identity: it allocates the next SP-nnn, derives the
 * QR path and applies mono/colour pricing rules. The client therefore sends
 * printer capabilities, not IDs. The response is mapped back into the shape the
 * mock (and every screen) already expects.
 */
async function createMachineLive({ shopId, name, model, supportsColor, supportsDuplex }) {
  const created = await apiClient.post('/api/machines', {
    shopId,
    name,
    printer: { model, supportsColor, supportsDuplex },
  });

  return {
    id: created.machineId,
    shopId: created.shopId,
    shopName: created.shopName,
    name: created.name,
    model: created.printer?.model ?? model,
    status: created.status,
    qrSlug: created.machineId,
    qrUrl: created.qrPath,
    registeredOn: created.createdAt,
    printer: created.printer,
    pricing: created.pricing,
  };
}

/** Mock implementation — see the live wiring above. */
async function createMachine_mock({ shopId, name, model, supportsColor, supportsDuplex, pricing }) {
  await delay(700);
  const shop = db.shops.find((s) => s.id === shopId);
  if (!shop) throw notFound('Shop not found');

  // Unique machine IDs are generated centrally — never by the client.
  const numericIds = db.machines
    .map((m) => Number(m.id.replace('SP-', '')))
    .filter((n) => !Number.isNaN(n));
  const nextNumber = Math.max(...numericIds, 0) + 1;
  const id = `SP-${String(nextNumber).padStart(3, '0')}`;

  const machine = {
    id,
    shopId,
    shopName: shop.name,
    name,
    model,
    status: 'offline',
    serial: `SN${Date.now().toString().slice(-8)}`,
    qrSlug: id,
    qrUrl: `/print/${id}`,
    registeredOn: new Date().toISOString().slice(0, 10),
    lastHeartbeat: null,
    paperLevel: 100,
    tonerLevel: 100,
    totalJobs: 0,
    jobsToday: 0,
    lifetimeRevenue: 0,
    pricing: {
      bwSingle: 2,
      bwDouble: 3,
      colorSingle: supportsColor ? 8 : 0,
      colorDouble: supportsColor ? 14 : 0,
      a3Surcharge: 1.6,
      minimumCharge: 5,
      ...pricing,
    },
    printer: {
      brand: model.split(' ')[0],
      model,
      supportsColor,
      supportsDuplex,
      paperTrays: ['A4', 'Letter'],
      maxPaperSize: 'A4',
      connection: 'Network (LAN)',
    },
    agent: {
      name: `${id.toLowerCase()}-agent`,
      version: '—',
      os: '—',
      status: 'disconnected',
      lastSeen: null,
      autoStart: false,
      queuedJobs: 0,
    },
  };

  db.machines.push(machine);
  emitChange();
  return { ...machine };
}

// PATCH /api/machines/:id/pricing
export async function updateMachinePricing(machineId, pricing) {
  await delay(440);
  const machine = db.machines.find((m) => m.id === machineId);
  if (!machine) throw notFound('Machine not found');
  machine.pricing = { ...machine.pricing, ...pricing };
  emitChange();
  return { ...machine };
}

// POST /api/machines/:id/commands
export async function sendAgentCommand(machineId, command) {
  await delay(520);
  const machine = db.machines.find((m) => m.id === machineId);
  if (!machine) throw notFound('Machine not found');
  db.agentCommands.unshift({
    id: `cmd_${Date.now()}`,
    machineId,
    command,
    sentAt: new Date().toISOString(),
    status: 'simulated',
  });
  emitChange();
  return { ok: true, simulated: true, command };
}

/* ---------------------------------------------------------------- orders --- */

// GET /api/orders?shopId=&machineId=&status=&limit=
export async function getOrders({ shopId, machineId, status, limit } = {}) {
  await delay(340);
  let list = [...db.orders];
  if (shopId) list = list.filter((o) => o.shopId === shopId);
  if (machineId) list = list.filter((o) => o.machineId === machineId);
  if (status) list = list.filter((o) => o.status === status);
  list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  if (limit) list = list.slice(0, limit);
  return list.map((o) => ({ ...o }));
}

// GET /api/orders/:id
export async function getOrder(orderId) {
  await delay(260);
  const order = db.orders.find((o) => o.id === orderId);
  if (!order) throw notFound('Order not found');
  return { ...order };
}

/**
 * POST /api/orders — created by the customer portal after a TEST payment.
 * NOTE: no real payment is processed. The order is flagged `simulated: true`
 * and its payment reference is prefixed `test_` so mock data stays obvious.
 */
export async function createOrder(payload) {
  await delay(900);
  const machine = db.machines.find((m) => m.id === payload.machineId);
  if (!machine) throw notFound('Machine not found');

  const order = {
    id: `SP${2000 + db.orders.length}`,
    ...payload,
    machineName: machine.name,
    shopId: machine.shopId,
    shopName: machine.shopName,
    status: ORDER_STATUS.QUEUED,
    paymentStatus: 'test_success',
    paymentRef: `test_pay_${Math.random().toString(36).slice(2, 12)}`,
    simulated: true,
    createdAt: new Date().toISOString(),
    completedAt: null,
  };
  db.orders.unshift(order);
  machine.jobsToday += 1;
  emitChange();
  return { ...order };
}

// PATCH /api/orders/:id/status
export async function updateOrderStatus(orderId, status) {
  await delay(380);
  const order = db.orders.find((o) => o.id === orderId);
  if (!order) throw notFound('Order not found');
  order.status = status;
  if (status === ORDER_STATUS.COMPLETED) order.completedAt = new Date().toISOString();
  emitChange();
  return { ...order };
}

// POST /api/orders/:id/refund  (never performs a real refund in this preview)
export async function refundOrder(orderId) {
  await delay(600);
  const order = db.orders.find((o) => o.id === orderId);
  if (!order) throw notFound('Order not found');
  order.status = ORDER_STATUS.REFUNDED;
  order.paymentStatus = 'test_refunded';
  order.simulated = true;
  emitChange();
  return { ...order };
}

/* -------------------------------------------------------------- analytics --- */

// GET /api/analytics/shop/:shopId
export async function getShopAnalytics(shopId) {
  await delay(400);
  const orders = db.orders.filter((o) => o.shopId === shopId);
  const paid = orders.filter((o) => o.paymentStatus === 'success' || o.simulated);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const todayOrders = orders.filter((o) => new Date(o.createdAt) >= startOfToday);
  const todayPaid = paid.filter((o) => new Date(o.createdAt) >= startOfToday);

  const days = Array.from({ length: 14 }).map((_, i) => {
    const day = new Date(startOfToday.getTime() - (13 - i) * 86400000);
    const end = new Date(day.getTime() + 86400000);
    const dayOrders = paid.filter((o) => {
      const created = new Date(o.createdAt);
      return created >= day && created < end;
    });
    return {
      date: day.toISOString().slice(0, 10),
      label: day.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
      orders: dayOrders.length,
      revenue: Math.round(dayOrders.reduce((sum, o) => sum + o.amount, 0)),
    };
  });

  const statusBreakdown = Object.values(ORDER_STATUS).map((status) => ({
    status,
    count: orders.filter((o) => o.status === status).length,
  }));

  return {
    todayOrders: todayOrders.length,
    todayRevenue: Math.round(todayPaid.reduce((sum, o) => sum + o.amount, 0)),
    todayPages: todayPaid.reduce((sum, o) => sum + o.pageCount * o.copies, 0),
    weekOrders: paid.filter((o) => new Date(o.createdAt) >= new Date(Date.now() - 7 * 86400000))
      .length,
    weekRevenue: Math.round(
      paid
        .filter((o) => new Date(o.createdAt) >= new Date(Date.now() - 7 * 86400000))
        .reduce((sum, o) => sum + o.amount, 0),
    ),
    monthRevenue: Math.round(
      paid
        .filter((o) => new Date(o.createdAt) >= new Date(Date.now() - 30 * 86400000))
        .reduce((sum, o) => sum + o.amount, 0),
    ),
    totalOrders: orders.length,
    pendingJobs: orders.filter((o) =>
      [ORDER_STATUS.PAID, ORDER_STATUS.QUEUED, ORDER_STATUS.PRINTING].includes(o.status),
    ).length,
    series: days,
    statusBreakdown,
    topDocuments: Object.entries(
      orders.reduce((acc, o) => {
        const name = o.documents?.[0]?.name ?? 'Document';
        acc[name] = (acc[name] || 0) + 1;
        return acc;
      }, {}),
    )
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count })),
  };
}

// GET /api/analytics/platform
export async function getPlatformAnalytics() {
  await delay(460);
  const orders = db.orders;
  const paid = orders.filter((o) => o.paymentStatus === 'success' || o.simulated);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  return {
    totalShops: db.shops.length,
    activeShops: db.shops.filter((s) => s.settings.acceptOrders).length,
    totalMachines: db.machines.length,
    onlineMachines: db.machines.filter((m) => m.status === 'online' || m.status === 'busy').length,
    offlineMachines: db.machines.filter((m) => m.status === 'offline').length,
    maintenanceMachines: db.machines.filter((m) => m.status === 'maintenance').length,
    totalJobs: orders.length,
    jobsToday: orders.filter((o) => new Date(o.createdAt) >= startOfToday).length,
    gmv: Math.round(paid.reduce((sum, o) => sum + o.amount, 0)),
    platformRevenue: Math.round(paid.reduce((sum, o) => sum + (o.platformFee || 0), 0)),
    mrr: 1499 * 3 + 3999 * 2,
    series: db.revenueSeries,
    funnel: db.funnel,
    planDistribution: ['starter', 'growth', 'scale'].map((planId) => ({
      planId,
      count: db.shops.filter((s) => s.planId === planId).length,
    })),
    cityDistribution: Object.entries(
      db.shops.reduce((acc, s) => {
        acc[s.city] = (acc[s.city] || 0) + 1;
        return acc;
      }, {}),
    ).map(([city, count]) => ({ city, count })),
  };
}

/* --------------------------------------------------------- subscriptions --- */

// PATCH /api/shops/:id/plan
export async function changePlan(shopId, planId) {
  await delay(650);
  const shop = db.shops.find((s) => s.id === shopId);
  if (!shop) throw notFound('Shop not found');
  shop.planId = planId;
  shop.planStatus = 'active';
  emitChange();
  return { ...shop };
}

// GET /api/subscription/invoices?shopId=
export async function getInvoices(shopId) {
  await delay(240);
  const shop = db.shops.find((s) => s.id === shopId);
  return db.invoices.map((inv) => ({
    ...inv,
    plan: shop?.planId === 'scale' ? 'Scale' : shop?.planId === 'starter' ? 'Starter' : inv.plan,
  }));
}

/* -------------------------------------------------------------- payments --- */

// GET /api/payouts?shopId=
export async function getPayouts(shopId) {
  await delay(300);
  return db.payouts.filter((p) => !shopId || p.shopId === shopId).map((p) => ({ ...p }));
}

// POST /api/payments/orders/:id/refund
export async function issueRefund(orderId, reason) {
  await delay(700);
  const order = db.orders.find((o) => o.id === orderId);
  if (!order) throw notFound('Order not found');
  order.status = ORDER_STATUS.REFUNDED;
  order.paymentStatus = 'test_refunded';
  order.refundReason = reason;
  order.simulated = true;
  emitChange();
  return { ...order, ok: true, simulated: true };
}

/* --------------------------------------------------------- notifications --- */

// GET /api/notifications
export async function getNotifications() {
  await delay(180);
  return db.notifications.map((n) => ({ ...n }));
}

// PATCH /api/notifications/:id/read
export async function markNotificationRead(id) {
  const notification = db.notifications.find((n) => n.id === id);
  if (notification) notification.read = true;
  emitChange();
  return { ok: true };
}
