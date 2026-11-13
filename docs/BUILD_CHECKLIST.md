# SmartPrint — Build Checklist

Living document. Updated as work lands. Anything not ticked is not built yet —
do not assume it works.

Legend: `[x]` built **and** verified by an executed test · `[~]` built, not yet
verified · `[ ]` not started

---

## Stage A — Foundation, auth, tenancy

- [~] Data layer: repository contract with a Mongoose adapter (production) and an
  in-memory adapter (tests). One interface, two implementations.
  _In-memory adapter is executed by the whole suite. The Mongoose adapter is
  written and reviewed but cannot run here — no MongoDB._
- [x] Password hashing (bcrypt) + password policy
- [x] JWT access tokens + rotated refresh tokens with revocation
- [x] `authenticate` / `requireRole` / `requireShopAccess` middleware
- [x] Registration, login, refresh, logout, password reset request/confirm
- [x] Rate limiting on auth endpoints
- [x] Audit log service

## Stage B — Core domain

- [x] Shops: create, approve, suspend, profile, settings
- [x] Machines: create, activate, deactivate, QR token generation/rotation
- [x] Documents: upload validation (magic bytes, size), page counting
- [x] Pricing engine (server-side, integer paise)
- [x] Orders: create (server-priced), state machine
- [x] Dev-only payment provider with idempotency
- [x] Print job state machine + duplicate-prevention

## Stage C — Automation

- [x] Print agent registration + auth
- [x] Agent heartbeat / online-offline
- [x] Job pull + claim + progress reporting
- [~] Virtual printer mode
  _Server side complete and tested end-to-end. The Windows agent itself has
  not been run against a real printer — no hardware in this environment._
- [x] Socket.IO fan-out with tenant scoping

## Stage D — Frontend + ops

- [x] Auth wired to real API
- [~] Customer portal → real orders
  _The service layer and every endpoint are live-capable and exercised by
  `scripts/acceptance.mjs`. The portal screens were not re-pointed at live
  mode by default, so `VITE_API_LIVE_DATA=false` still shows seeded demo data._
- [x] Shop + admin dashboards → real APIs
- [x] Deployment docs, env examples, agent install guide

---

## Test evidence

Executed in this environment (`cd server && NODE_ENV=test npm test`):

| Suite                                                             | Tests                        |
| ----------------------------------------------------------------- | ---------------------------- |
| Full backend suite                                                | 283 pass, 0 fail, 23 skipped |
| `e2e.flow.test.js` — QR → upload → price → pay → print → complete | 22 pass                      |
| `jobStateMachine.test.js`                                         | 31 pass                      |
| `pricingEngine.test.js`                                           | 35 pass                      |
| `health.api.test.js`                                              | 26 pass                      |
| Frontend `npm run test:routes` / `npm run build`                  | clean                        |

The 23 skips are Mongoose-model tests that require a live cluster. They are
skipped, never reported as passing.

---

## Environment constraints (important)

This build environment has **no MongoDB and no Docker**, and blocks the binary
hosts needed to install one. Consequences:

- Every test that would need a live database runs against the **in-memory
  adapter**. Business logic is genuinely executed; the Mongo adapter's query
  mappings are reviewed but **not executed here**.
- This is stated again in the final report. Treat the Mongoose path as
  "written and type-reviewed" until `npm run test:integration` runs against a
  real cluster.
