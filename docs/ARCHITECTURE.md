# SmartPrint — Architecture Notes

This document explains the decisions behind the frontend and the contract the backend must honour.

The backend foundation now exists in `server/` (Express + Mongoose). It implements the health,
machine and shop surfaces described here; the sections below remain the contract for the order,
payment and agent work that follows. Where the code and this document disagree, the code is the
safer read — the response envelope and machine-ID rules are asserted by tests in
`server/test/`.

## 1. Tenancy model

```
Platform (SmartPrint)
├── Shop A  (shopId: shop_hsr_01, plan: growth)
│   ├── Machine SP-001  → QR /print/SP-001   → agent press-01-agent
│   ├── Machine SP-002  → QR /print/SP-002   → agent press-01-agent
│   └── Orders …
├── Shop B  (shopId: shop_hsr_02, plan: starter)
│   ├── Machine SP-004  → QR /print/SP-004   → agent campus-agent-1
│   …
```

- **Machine IDs are global, not per shop.** `SP-001` resolves to exactly one shop, permanently.
  This is what makes a QR sticker safe to laminate onto a printer.
- **Pricing is per machine.** Two printers in one shop may have different cost profiles.
- **Orders are immutable in ownership.** An order stores both `machineId` and `shopId` (denormalised
  for reporting) at creation time; moving a machine to another shop never rewrites history.

## 2. The QR → order contract

1. QR encodes `${origin}/print/${machineId}`.
2. The portal calls `GET /api/machines/:machineId`.
3. The API must:
   - reject unknown IDs with 404,
   - return the machine, its shop, its pricing and capabilities,
   - return availability (`online`, `busy`, `maintenance`, `offline`) and shop order-acceptance.
4. The UI disables payment when the machine is offline/maintenance or the shop paused orders.
5. `POST /api/orders` re-validates the machine, pricing and availability server-side. **The client
   never submits a price that is trusted.**

## 3. Order lifecycle

```
awaiting_payment ──pay──> paid ──> queued ──> printing ──> completed
                                   │            │
                                   └── failed ◄─┘
                                   └── refunded
```

- `paid` means the gateway verified the payment.
- `queued` means the job is visible to the machine's agent.
- The agent owns `printing` / `completed` / `failed` transitions.
- Refunds are a shop/admin action and are logged.

## 4. Print agent contract (future)

The agent is a separate local service (Node.js or a packaged binary) with one job: turn a queued job
into paper.

| Direction   | Endpoint                              | Purpose                                      |
| ----------- | ------------------------------------- | -------------------------------------------- |
| Agent → API | `POST /api/agents/:agentId/heartbeat` | status, paper/toner, queue depth, every 30s  |
| Agent → API | `GET /api/agents/:agentId/jobs`       | claim next paid job for a paired machine     |
| Agent → API | `PATCH /api/orders/:id/status`        | printing / completed / failed (+ error code) |
| API → Agent | `POST /api/machines/:id/commands`     | ping, cancel, test page                      |

Rules:

- The agent authenticates with a pairing token issued at registration, scoped to its machines.
- The agent downloads the document from a short-lived signed URL, prints, then the platform deletes
  the object.
- Missing three heartbeats marks the machine offline; queued jobs survive and resume on reconnect.

## 5. Payment contract (future)

- Gateway checkout is created server-side; the amount is computed from the same pricing engine that
  produced the customer quote.
- The job is released only after **webhook verification**, never on the client callback.
- All payment references are stored on the order and shown in payment reports.
- This preview deliberately never simulates a _successful real_ payment: the test panel is labelled,
  the order is flagged `simulated`, and settlement tables are static sample data.

## 6. Roles

| Role                 | Can do                                                        |
| -------------------- | ------------------------------------------------------------- |
| Customer (anonymous) | Read one machine, create one order, read that order           |
| Shop owner / manager | Read/write everything scoped to their `shopId`                |
| Super admin          | Read all tenants, create shops/machines, manage plans, refund |

Client guards in `ProtectedRoute` are UX only. Every endpoint must re-authorise from the JWT.

## 7. Frontend performance

- Route-level code splitting (`React.lazy`) — landing, portals and both dashboards load separately.
- pdf.js is a dynamic import, loaded only when a customer actually picks a PDF.
- Charts are dependency-free SVG (no charting library shipped).
- Fonts: Inter Variable, self-hosted via `@fontsource-variable/inter` (no third-party request).

## 8. Known preview limitations

- In-memory store: refreshing resets orders, profile edits and plan changes.
- No file upload; PDFs are parsed in the browser and never leave the device.
- No real gateway, no settlement engine, no agent.
- Analytics are computed from the demo dataset, not a warehouse.

## 8. API conventions (as implemented)

**Response envelope.** Every endpoint returns one of exactly two shapes, so the client needs one
parser:

```jsonc
// success
{ "success": true, "data": { /* … */ }, "meta": { /* pagination, counts, … */ } }

// failure
{
  "success": false,
  "error": { "code": "VALIDATION_ERROR", "message": "…", "details": { "machineId": "…" } },
  "requestId": "01J…"
}
```

`requestId` is also sent as the `X-Request-Id` header and appears in the server log line for the
same request, which is what makes a user-reported failure traceable without guessing.

**Error codes are stable and machine-readable** (`VALIDATION_ERROR`, `NOT_FOUND`,
`MACHINE_NOT_FOUND`, `ROUTE_NOT_FOUND`, `NOT_IMPLEMENTED`, `DATABASE_UNAVAILABLE`,
`RATE_LIMITED`, `INTERNAL_ERROR`). Clients branch on `code`, never on message text.

**Status-code rules**

| Situation                               | Status | Code                   |
| --------------------------------------- | ------ | ---------------------- |
| Malformed input (bad ID, missing field) | 422    | `VALIDATION_ERROR`     |
| Unknown but well-formed resource        | 404    | `…_NOT_FOUND`          |
| Route reserved for a later phase        | 404    | `NOT_IMPLEMENTED`      |
| Database required and unavailable       | 503    | `DATABASE_UNAVAILABLE` |
| Rate limit exceeded                     | 429    | `RATE_LIMITED`         |

Input validation always runs **before** the database guard, so a bad request is reported as bad
even during an outage.

**Health endpoints are exempt from rate limiting** and never touch the database on `/api/health`,
so a monitoring system can always tell "process alive" from "database down".

**Machine ID rules.** `SP-` followed by 3–6 digits, allocated centrally and never reused. Parsing is
deliberately lenient (`sp-1`, `SP-001` and `sp-1` all resolve to `SP-001`) because IDs are read
from stickers, screenshots and human typing; storage is always canonical. The uniqueness of a
machine ID is enforced by a unique index, because a QR code that resolves to two printers is a
billing incident, not a UI bug.
