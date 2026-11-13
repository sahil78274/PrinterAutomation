# SmartPrint

**QR-based automated self-service document printing platform.**

SmartPrint turns any print shop counter into a touchless self-service kiosk. A customer scans a
machine-specific QR code, uploads a PDF, picks their options, pays, and collects — while a local
Print Agent running on the shop's computer sends the job to the printer.

This repository contains the **complete frontend** (React + Vite + Tailwind CSS + Framer Motion) and
the **backend foundation** (Node.js + Express + MongoDB): API scaffolding, data models, core
services, health/observability endpoints and a tested request pipeline. The frontend still runs
entirely on local sample data by default; the backend is wired in behind a single switch.

---

## Quick start

```bash
npm install
npm run dev      # frontend → http://localhost:5173

cd server && npm install
cp .env.example .env   # then set MONGODB_URI
npm run dev            # API → http://localhost:5000
```

The frontend and backend run independently: the app is fully usable with the API switched off, and
the API runs (degraded) without a database. Requires Node.js 18+; MongoDB 7+ for the backend.

Health check once the API is up:

```bash
curl http://127.0.0.1:5000/api/health
```

---

## What is inside

| Interface               | Routes              | Purpose                                                                        |
| ----------------------- | ------------------- | ------------------------------------------------------------------------------ |
| **Marketing site**      | `/`                 | Hero, how it works, features, for-shop-owners, pricing, FAQ                    |
| **Auth**                | `/login`            | Login + shop registration (mock auth, demo accounts listed)                    |
| **Customer portal**     | `/print/:machineId` | Machine-locked upload → options → TEST payment flow                            |
| **Order tracking**      | `/order/:orderId`   | Live print status with simulated agent updates                                 |
| **Shop owner console**  | `/shop/*`           | Overview, orders, machines, pricing, payments, subscription, profile           |
| **Super admin console** | `/admin/*`          | Network overview, shops, machine registry + QR, jobs, subscriptions, analytics |

Try a machine QR directly: **`/print/SP-001`** (Sharma Digital Press, Counter A).

The `server/` workspace is a separate Node package — see [Backend](#backend) below.

### Demo accounts

| Role                  | Email                  | Password   |
| --------------------- | ---------------------- | ---------- |
| Shop owner            | `owner@smartprint.in`  | `demo1234` |
| Shop owner (2nd shop) | `campus@smartprint.in` | `demo1234` |
| Super admin           | `admin@smartprint.in`  | `demo1234` |

The login screen lists these and fills them in with one click.

---

## Architecture

```
src/
├── components/
│   ├── charts/      AreaChart, BarChart, DonutChart, Sparkline, ProgressBar (hand-rolled SVG)
│   ├── customer/    DocumentUploader, DocumentCard, OrderSummary, TestPaymentPanel
│   ├── layout/      PublicHeader, PublicFooter, DashboardLayout
│   ├── machines/    QrCode, QrModal
│   ├── marketing/   Hero, HowItWorks, Features, ForShopOwners, Pricing, Faq, CtaSection
│   ├── orders/      OrderStatusBadge, OrderDetailDrawer
│   ├── shop/        MachineCard, MachineConfigModal
│   └── ui/          Button, Input, Card, Badge, Modal, DataTable, StatCard, Skeleton, …
├── config/          navigation.js (sidebar definitions per role)
├── context/         AuthContext (session + role), ToastContext (notifications)
├── data/            seed.js — deterministic mock dataset
├── hooks/           useAsync
├── lib/             utils, constants, pricing engine, pdf.js (pdf.js integration)
├── pages/
│   ├── admin/       AdminOverview, AdminShops, AdminMachines, AdminMachineDetail, AdminJobs,
│   │                AdminSubscriptions, AdminAnalytics
│   ├── customer/    PrintPortal, OrderTracking
│   ├── public/      LandingPage, LoginPage
│   └── shop/        ShopOverview, ShopOrders, ShopOrderDetail, ShopMachines, ShopPricing,
│                    ShopPayments, ShopSubscription, ShopSettings
├── services/        api.js (mock API), db.js (in-memory store)
└── App.jsx          route table + lazy loading + role guards
```

### Multi-tenant model

The platform serves many independent shops, each with many machines:

```
Shop (shopId)
  └── Machine (machineId = SP-001, globally unique)
        ├── unique QR URL   /print/SP-001
        ├── registered print agent (agent name, heartbeat, version)
        ├── printer configuration (model, colour, duplex, trays)
        └── pricing configuration (per-side rates, A3 multiplier, minimum)
  └── Orders (each bound to exactly one machineId + shopId)
```

**A machine QR always identifies the correct machine.** The QR encodes
`https://<origin>/print/SP-001`; the portal resolves that ID to a shop and machine _before_ an
order can exist. IDs are issued centrally by the platform (admin registry) and never chosen by a
client.

### Printing is never browser-to-printer

```
Customer browser ──HTTPS──> SmartPrint API ──queue──> Local Print Agent ──driver──> Printer
```

The browser only creates an order. A local Print Agent (a separate future service, installed on the
shop PC) polls/receives jobs for its paired machines, prints them with the OS driver, and reports
status back. Nothing in this frontend talks to hardware.

### Pricing engine

`src/lib/pricing.js` is the single source of truth. Every displayed figure — customer quote, shop
revenue, admin analytics — comes from `calculateQuote()`, so totals can never drift between
interfaces. Rates are stored **per machine**, not per shop.

---

## Backend

`server/` is a standalone Express + MongoDB package (`type: module`, no build step).

```
server/
├── config/       env parsing + validation, MongoDB connection lifecycle
├── middleware/   request id/context, structured logging, errors, rate limits,
│                 input validation, database guard, dev-only admin guard
├── models/       Shop, Machine, User, PrintOrder (Mongoose schemas + invariants)
├── services/     machine registration/ID allocation, pricing, health, shops
├── validators/   dependency-free input validation → { value, errors }
├── controllers/  HTTP layer — no business logic
├── routes/       /api/health, /api/machines, /api/shops (+ reserved namespaces)
├── test/         node:test suites: health API, unit, integration
├── app.js        createApp() factory (no side effects, safe to import in tests)
└── server.js     process entry: config check, DB connect, graceful shutdown
```

### Design decisions worth knowing

- **The process does not crash without a database.** It starts, reports
  `database.status: "unreachable"` on `/api/health`, returns `503 DATABASE_UNAVAILABLE` from
  data-backed routes, and reconnects on its own. A crash loop would hide the failure instead of
  exposing it.
- **Validation runs before the database guard.** A malformed input is a `422` whether or not Mongo
  is up — the client is told its request is wrong, not that the server is broken.
- **One response envelope.** Success is `{ success: true, data, meta? }`; failure is
  `{ success: false, error: { code, message, details? }, requestId }`. `requestId` is echoed in the
  `X-Request-Id` header and appears in logs, so a user-reported failure is traceable.
- **Machine IDs are issued by the server**, never by a client: global `SP-nnn` sequence, allocated
  with a unique-index retry loop so two concurrent registrations cannot collide. A QR sticker must
  resolve to exactly one machine.
- **Admin routes are guarded but not yet authenticated.** `devOnlyAdmin` returns `404` unless
  `ALLOW_ANONYMOUS_ADMIN=true` in a non-production environment. Phase 3 replaces it with JWT +
  role checks; the guard is a single middleware so no route changes.
- **Errors are typed and non-leaky.** `ApiError` carries a status, a stable machine-readable `code`
  and optional `details`; stack traces never reach the response.

### Environment

| Variable                                  | Default                 | Notes                                      |
| ----------------------------------------- | ----------------------- | ------------------------------------------ |
| `NODE_ENV`                                | `development`           | `production` enforces CORS + config checks |
| `PORT` / `HOST`                           | `5000` / `0.0.0.0`      |                                            |
| `CLIENT_URL`                              | `http://localhost:5173` | Comma-separated CORS allowlist             |
| `MONGODB_URI`                             | —                       | Empty ⇒ degraded mode, not a crash         |
| `MONGO_SERVER_SELECTION_TIMEOUT_MS`       | `8000`                  | Fail fast instead of buffering commands    |
| `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX` | `900000` / `300`        | `/api/health` is always exempt             |
| `TRUST_PROXY`                             | `false`                 | Set when behind a load balancer            |
| `SHUTDOWN_TIMEOUT_MS`                     | `10000`                 | Forced exit if graceful shutdown stalls    |
| `ALLOW_ANONYMOUS_ADMIN`                   | `false`                 | Dev-only escape hatch for admin routes     |

### Endpoints implemented today

```
GET  /api                        index of the surface
GET  /api/health                 liveness + database state (always 200 if the process is alive)
GET  /api/health/ready           200 when ready, 503 NOT_READY when the database is unavailable
GET  /api/health/details         uptime, memory, dependency detail
GET  /api/machines/:machineId    public QR resolution (422 malformed, 404 unknown)
GET  /api/machines?shopId=       shop-scoped listing (shopId required — no cross-tenant dumps)
POST /api/machines               register a machine (admin; server allocates the ID)
GET  /api/shops                  list shops (admin)
GET  /api/shops/:identifier      by id or SH- code (admin)
POST /api/shops                  create a shop (admin)
```

`/api/auth/*`, `/api/orders/*`, `/api/pricing`, `/api/agents`, `/api/analytics` and
`/api/subscriptions` are reserved and currently answer `404 NOT_IMPLEMENTED` — they are Phase 3+.

### Tests

```bash
cd server
npm test                 # everything below
npm run test:unit        # pricing + machine-ID rules (no I/O)
npm run test:api         # HTTP contract tests against an in-process app
npm run test:integration  # real MongoDB; SKIPPED automatically when none is reachable
```

`test:integration` uses a throwaway database name and drops it afterwards, so pointing it at a
shared cluster cannot damage real data. In an environment without MongoDB (such as CI without a
database service) those tests report `# SKIP` rather than failing.

---

## Switching the frontend onto the API

`src/services/api.js` contains both implementations. Mock bodies are unchanged; each live-capable
function is a three-line wrapper:

```js
export async function getMachine(machineId) {
  return withLive(
    'getMachine',
    () => apiClient.get(`/api/machines/${encodeURIComponent(machineId)}`),
    () => getMachine_mock(machineId),
  );
}
```

- **Mock is the default.** With `VITE_API_BASE_URL` empty the app never makes a network request.
- **Live is per-endpoint.** `LIVE_ENDPOINTS` lists only the routes the server actually implements,
  so enabling the API cannot break a screen whose backend does not exist yet.
- **Transport failures fall back to mock**, with a console warning — a stopped backend degrades the
  demo instead of blanking it. A `4xx`/`5xx` from the API is _not_ swallowed: it is a real answer
  and surfaces to the UI.
- **The client owns no formatting rules.** `src/services/apiClient.js` handles the base URL, bearer
  token, envelope unwrapping, typed `ApiClientError`s and request timeouts.

Enable it with:

```bash
# .env.local
VITE_API_BASE_URL=            # empty → same-origin, proxied by vite to :5000
```

---

## Mock data & simulated functionality

Everything in this preview runs on local sample data. To keep that unambiguous:

- `src/services/db.js` is an in-memory store seeded from `src/data/seed.js`
  (8 shops, 15 machines, ~400 orders across 28 days).
- `src/services/api.js` exposes promise-based functions that mimic the future REST API, including
  simulated latency. Each function documents its planned endpoint, e.g. `GET /api/orders?shopId=`.
- Customer orders created in the portal appear immediately in the shop and admin consoles.
- A `MockBadge` / `MockNotice` marks every screen that shows sample data.
- **Payments never succeed for real.** The payment panel is labelled `TEST MODE`, prefixed
  `test_pay_`, and every resulting order carries `simulated: true`, which is surfaced on the
  tracking page and in the dashboards.
- The print agent lifecycle can be stepped through manually on `/order/:id` — clearly marked as a
  demo control.

State lives in memory and resets on refresh (except the auth session, which is kept in
`localStorage`).

---

## Route protection

`ProtectedRoute` gates `/shop/*` (role `shop`) and `/admin/*` (role `admin`), redirecting
unauthenticated users to `/login?redirect=…` and showing a "Restricted area" screen on role
mismatch.

> **This is a placeholder.** Client-side guards are UX only. In production every Express endpoint
> must verify the JWT and re-check that the resource belongs to the caller's `shopId` (or that the
> caller is an admin). The guard is isolated in one component so it can be swapped for a
> server-verified implementation without touching pages.

---

## Remaining integration work

The service seam exists (see [Switching the frontend onto the API](#switching-the-frontend-onto-the-api));
what is left is backend surface, not frontend rewiring:

1. **Authentication.** `POST /api/auth/login` returning the `{ token, user }` shape `AuthContext`
   already stores, JWT verification middleware, and a role check replacing `devOnlyAdmin`.
2. **Orders.** `POST /api/orders` must re-price server-side from the machine's stored rates — never
   trust a client-supplied total — and verify payment before releasing a job to the agent.
3. **Uploads.** `src/lib/pdf.js` reads page counts locally with pdf.js. In production the file goes
   to object storage and the order stores the resulting key; the server should re-verify the page
   count it is billed on.
4. **Realtime.** Order tracking polls the in-memory store. Swap the timer for SSE/WebSocket job events
   so a status change appears without a refresh.
5. **Payments.** Replace `TestPaymentPanel` with the gateway checkout; verify webhooks server-side
   before a job is queued.
6. **Print agent.** `POST /api/agents/:id/heartbeat` plus a job-pull endpoint, per the contract in
   `docs/ARCHITECTURE.md`.

### Remaining API surface

Implemented routes are listed under [Endpoints implemented today](#endpoints-implemented-today).
Still to build:

```
POST   /api/auth/login                 POST   /api/auth/refresh
GET    /api/orders                     GET    /api/orders/:id
POST   /api/orders                     PATCH  /api/orders/:id/status
PATCH  /api/shops/:id                  PATCH  /api/shops/:id/settings
PATCH  /api/machines/:id/pricing       POST   /api/machines/:id/commands
POST   /api/agents/:id/heartbeat       GET    /api/analytics/shop/:shopId
GET    /api/analytics/platform         GET    /api/payouts
POST   /api/payments/orders/:id/refund GET    /api/subscription/invoices
PATCH  /api/shops/:id/plan
```

### Collections

Models exist for `shops`, `machines`, `users` and `print_orders` (with an embedded
`order_events` timeline) in `server/models/`. Still to add: `agents`, `payouts`, `subscriptions`,
`invoices`. Existing indexes cover `machines.machineId` (unique), `shops.shopCode` (unique) and
`orders.shopId + createdAt`.

---

## Design system

- **Palette** — white / `#F7F8FA` surfaces, navy `#0B1D3A` type, professional blue `#2459E8` accent.
  No decorative gradients, no emoji, controlled radii (8–12px).
- **Type** — Inter Variable, tight tracking on headings, tabular numerals in all data.
- **Motion** — 200–300 ms, `cubic-bezier(0.22, 1, 0.36, 1)`; all motion respects
  `prefers-reduced-motion`.
- **Charts** — hand-built SVG (no chart library) for full styling control and a small bundle.
- **Accessibility** — semantic landmarks, labelled controls, visible focus rings, ARIA on
  switches/segmented controls, ≥ 4.5:1 contrast for body text.

---

## Scripts

| Command                 | Description                                                                     |
| ----------------------- | ------------------------------------------------------------------------------- |
| `npm run dev`           | Vite dev server on `0.0.0.0:5173`                                               |
| `npm run build`         | Production build                                                                |
| `npm run preview`       | Preview the production build                                                    |
| `npm run lint`          | ESLint (react + hooks rules)                                                    |
| `npm run test`          | Lint + all four headless checks below                                           |
| `npm run test:routes`   | Headless jsdom render check of all 22 routes                                    |
| `npm run test:flow`     | Pricing engine + page parser + portal/tracking interaction test (27 assertions) |
| `npm run test:a11y`     | h1 / alt text / button names / field labelling audit                            |
| `npm run test:live-api` | Mock/live service seam: envelope unwrapping, fallback, timeouts (16 checks)     |
| `npm run format`        | Prettier                                                                        |

---

## Status

**Frontend — complete and verified.** Production build passes, all 22 routes render without runtime
errors in a headless check, 27 functional assertions pass (including the pricing engine), the
accessibility audit is clean, and lint is error-free.

**Backend — foundation in place.** Server runs, health/observability endpoints work, models and
validators are in place with 73 unit + API assertions passing, and machine/shop routes are
implemented. Verified live: envelope shape, `X-Request-Id`, security headers, CORS allowlist,
rate limiting (`429` after the window), malformed-input `422`s and `503`s while the database is
down.

**Not yet built** — and deliberately out of scope for this phase:

| Area                        | State                                                                                                                                                                                                |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authentication              | No JWT issuance or verification; admin routes use a dev-only guard                                                                                                                                   |
| Orders & payments           | `/api/orders`, `/api/payments` reserved; no gateway integration                                                                                                                                      |
| Print agent                 | Contract documented in `docs/ARCHITECTURE.md`; no agent service                                                                                                                                      |
| Database-verified behaviour | `test:integration` is written but **has never run against a real MongoDB** in this delivery environment — no MongoDB server was available. Treat the schema and query paths as reviewed, not proven. |

The honest summary: the frontend is production-ready as a demo, and the backend is a solid,
tested skeleton whose database layer still needs one run against a real cluster.
