# SmartPrint — Build Checklist

Living document. Updated as work lands. Anything not ticked is not built yet —
do not assume it works.

Legend: `[x]` built **and** verified by an executed test · `[~]` built, not yet
verified · `[ ]` not started

---

## Stage A — Foundation, auth, tenancy

- [ ] Data layer: repository contract with a Mongoose adapter (production) and an
      in-memory adapter (tests). One interface, two implementations.
- [ ] Password hashing (bcrypt) + password policy
- [ ] JWT access tokens + rotated refresh tokens with revocation
- [ ] `authenticate` / `requireRole` / `requireShopAccess` middleware
- [ ] Registration, login, refresh, logout, password reset request/confirm
- [ ] Rate limiting on auth endpoints
- [ ] Audit log service

## Stage B — Core domain

- [ ] Shops: create, approve, suspend, profile, settings
- [ ] Machines: create, activate, deactivate, QR token generation/rotation
- [ ] Documents: upload validation (magic bytes, size), page counting
- [ ] Pricing engine (server-side, integer paise)
- [ ] Orders: create (server-priced), state machine
- [ ] Dev-only payment provider with idempotency
- [ ] Print job state machine + duplicate-prevention

## Stage C — Automation

- [ ] Print agent registration + auth
- [ ] Agent heartbeat / online-offline
- [ ] Job pull + claim + progress reporting
- [ ] Virtual printer mode
- [ ] Socket.IO fan-out with tenant scoping

## Stage D — Frontend + ops

- [ ] Auth wired to real API
- [ ] Customer portal → real orders
- [ ] Shop + admin dashboards → real APIs
- [ ] Deployment docs, env examples, agent install guide

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
