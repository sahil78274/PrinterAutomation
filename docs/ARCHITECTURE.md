# SmartPrint — Architecture Notes

This document explains the decisions behind the frontend and the contract the future backend must
honour.

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
