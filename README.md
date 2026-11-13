# SmartPrint

**QR-based automated self-service document printing platform.**

SmartPrint turns any print shop counter into a touchless self-service kiosk. A customer scans a
machine-specific QR code, uploads a PDF, picks their options, pays, and collects — while a local
Print Agent running on the shop's computer sends the job to the printer.

This repository contains the **complete frontend** (React + Vite + Tailwind CSS + Framer Motion),
built to production quality and pre-wired for a future Node.js / Express / MongoDB backend.

---

## Quick start

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build to dist/
npm run preview  # serve the production build
```

Requires Node.js 18+.

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

## Preparing for the backend

The frontend is structured so integration is additive rather than a rewrite:

1. **Swap the service layer.** `src/services/api.js` already has the exact function signatures UI
   components import. Replace each body with a `fetch` to the documented endpoint.
2. **Env config.** `VITE_API_BASE_URL` selects a real API; `vite.config.js` proxies `/api` to
   Express on `:5000` during development.
3. **Auth.** `AuthContext` stores a token and user object shaped like `/api/auth/login` should
   return. Add refresh-token handling in `login()` only.
4. **Uploads.** `src/lib/pdf.js` reads page counts locally with pdf.js. In production, upload the
   file to object storage and store the resulting key on the order document.
5. **Realtime.** Order tracking currently polls the in-memory store. Swap `useAsync`/the timer for
   a WebSocket or SSE subscription to job events.
6. **Payments.** Replace `TestPaymentPanel` with the gateway checkout and verify webhooks
   server-side before releasing a job to the agent.

### Suggested API surface

```
POST   /api/auth/login                 POST   /api/auth/refresh
GET    /api/shops                      GET    /api/shops/:id
PATCH  /api/shops/:id                  PATCH  /api/shops/:id/settings
GET    /api/machines                   GET    /api/machines/:machineId   (public)
POST   /api/machines                   PATCH  /api/machines/:id/pricing
POST   /api/machines/:id/commands      POST   /api/agents/:id/heartbeat
GET    /api/orders                     GET    /api/orders/:id
POST   /api/orders                     PATCH  /api/orders/:id/status
GET    /api/analytics/shop/:shopId     GET    /api/analytics/platform
GET    /api/payouts                    POST   /api/payments/orders/:id/refund
GET    /api/subscription/invoices      PATCH  /api/shops/:id/plan
```

### Suggested MongoDB collections

`shops`, `machines`, `orders`, `order_events`, `agents`, `payouts`, `subscriptions`, `invoices`,
`users`. Index `machines.machineId` (unique), `orders.shopId + createdAt`, `orders.machineId`.

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

| Command               | Description                                                                     |
| --------------------- | ------------------------------------------------------------------------------- |
| `npm run dev`         | Vite dev server on `0.0.0.0:5173`                                               |
| `npm run build`       | Production build                                                                |
| `npm run preview`     | Preview the production build                                                    |
| `npm run lint`        | ESLint (react + hooks rules)                                                    |
| `npm run test`        | Lint + all three headless checks below                                          |
| `npm run test:routes` | Headless jsdom render check of all 22 routes                                    |
| `npm run test:flow`   | Pricing engine + page parser + portal/tracking interaction test (27 assertions) |
| `npm run test:a11y`   | h1 / alt text / button names / field labelling audit                            |
| `npm run format`      | Prettier                                                                        |

---

## Status

Frontend complete and verified: production build passes, all 22 routes render without runtime
errors in a headless check, 27 functional assertions pass (including the pricing engine), and the
accessibility audit is clean. Backend, print agent and payment gateway are out of scope for this
delivery and are documented above for the integration phase.
