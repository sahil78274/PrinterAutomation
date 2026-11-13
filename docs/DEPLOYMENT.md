# Deploying SmartPrint

Everything here has been executed in the build environment **except** where
marked. Anything marked _unverified_ is documented as a gap rather than claimed
as working — see [What is not verified](#what-is-not-verified).

---

## 1. What you are deploying

| Piece                  | Path            | Runs on                     |
| ---------------------- | --------------- | --------------------------- |
| Web app (React + Vite) | repository root | any static host or Node     |
| API (Express, ESM)     | `server/`       | Node 18+                    |
| Print Agent (CLI)      | `agent/`        | **Windows**, at the shop    |
| Database               | —               | MongoDB (optional at first) |

The API runs on an **in-memory repository** when MongoDB is absent, so you can
deploy and click through the whole product before provisioning a database. Data
does not survive a restart in that mode — the health endpoint says so, and
`/api/admin/system` reports which adapter is live.

---

## 2. API

### 2.1 Install

```bash
cd server
npm install
cp .env.example .env
```

### 2.2 Configure

The API **refuses to boot in production** without the first two.

| Variable                | Required     | Notes                                                                                            |
| ----------------------- | ------------ | ------------------------------------------------------------------------------------------------ |
| `NODE_ENV`              | yes          | `production` enables the guards below                                                            |
| `JWT_SECRET`            | yes          | ≥ 32 chars. Generate: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `MONGODB_URI`           | no           | Absent ⇒ in-memory adapter                                                                       |
| `PORT`                  | no           | Default `5000`                                                                                   |
| `CORS_ORIGINS`          | production   | Comma-separated exact origins                                                                    |
| `ADMIN_SETUP_KEY`       | to bootstrap | Enables `POST /api/auth/bootstrap-admin`; unset ⇒ route 404s                                     |
| `PLATFORM_FEE_BPS`      | no           | Default `600` = 6%                                                                               |
| `REFRESH_TOKEN_PEPPER`  | recommended  | Mixed into stored refresh-token hashes                                                           |
| `SMARTPRINT_UPLOAD_DIR` | no           | Private document root, default `server/storage`                                                  |
| `MAX_UPLOAD_MB`         | no           | Default 20                                                                                       |

**Production boot guards (executed):**

- Production + missing/short `JWT_SECRET` ⇒ **fatal**, the process exits.
- Production + `PAYMENT_PROVIDER=development` ⇒ **fatal**. This build cannot take
  real money, and it will not let you forget that at 2am.

### 2.3 Create the first administrator

There is no default admin and no seeded password, by design. Set
`ADMIN_SETUP_KEY`, then:

```bash
curl -X POST https://your-api.example.com/api/auth/bootstrap-admin \
  -H 'Content-Type: application/json' \
  -d '{"name":"Platform Admin","email":"you@example.com","password":"<strong>","setupKey":"'"$ADMIN_SETUP_KEY"'"}'
```

The key is compared in constant time. Unset the variable and restart once the
admin exists: the route then answers 404 and cannot be probed.

### 2.4 Start

```bash
NODE_ENV=production npm start
```

Verify:

```bash
curl https://your-api.example.com/api/health
```

### 2.5 Behind a proxy

Terminate TLS at the proxy and forward `X-Forwarded-For`; the rate limiters key
on `req.ip`. Trust proxy is configured for a single hop — adjust
`app.set('trust proxy', …)` in `server/app.js` if your topology is deeper.

---

## 3. Web app

```bash
npm install
npm run build      # → dist/
```

Serve `dist/` from any static host. Configure at build time:

| Variable             | Purpose                                                         |
| -------------------- | --------------------------------------------------------------- |
| `VITE_API_BASE_URL`  | API origin, e.g. `https://api.example.com`. Empty ⇒ same origin |
| `VITE_API_LIVE_DATA` | `true` ⇒ screens read the real API; otherwise seeded demo data  |
| `VITE_API_PROXY`     | Dev-server proxy target (development only)                      |

`npm run build` and `npm run test:routes` were both executed and pass.

---

## 4. Print Agent

Full instructions live in [`agent/README.md`](../agent/README.md). Short version,
on the shop's Windows PC:

```powershell
cd agent
npm install
npm run register -- --server https://your-api.example.com --machine SP-001 --token <owner-token>
npm run doctor
npm start
```

The agent key is printed **once** and stored only as a SHA-256 digest on the
server. It is written to `agent/agent.config.json`, which is git-ignored and
created `0600`.

`npm run doctor` is the support tool: it reports Node version, platform, whether
real printing is even possible there, registration state, server reachability and
whether a printer is detected — without printing anything.

---

## 5. What is not verified

Read this before promising a customer anything.

| Area                     | Status                                                                                                                                                                                                         |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Physical printing**    | The Windows spooler call has **never been executed** — this environment has no Windows machine and no printer. Everything around it is tested; the final step is not. Print one real job and watch the paper.  |
| **MongoDB adapter**      | Written and reviewed, **never executed** against a live cluster. Every automated test runs on the in-memory adapter. Run `cd server && npm run test:integration` with a real `MONGODB_URI` before trusting it. |
| **Payments**             | The only provider is `developmentProvider`. It is simulated, every record is marked `simulated: true`, and production boot refuses it. Real gateway integration is not started.                                |
| **Subscription billing** | Invoices and plan changes are real records with real arithmetic, but no money moves and production refuses the billing service.                                                                                |
| **Email**                | Password-reset tokens are generated and verified; no mail is sent. Deliver the token out of band or add a transport.                                                                                           |
| **Object storage**       | Documents live on the local filesystem. A multi-instance deployment needs shared storage.                                                                                                                      |

---

## 6. Operational notes

**Documents are private.** There is no static route for the storage directory;
`server/storage/documents/` is git-ignored and its README explains the access
rules. Files are written `0600` and deleted when their job completes.

**Simulated revenue is split out.** `/api/analytics/shop` returns
`revenue.simulatedPaise`, `revenue.realPaise` and `revenue.entirelySimulated`
alongside the total, so no dashboard can silently show fake money as takings.

**Agents are offline after 90 seconds.** Liveness is computed at read time from
the last heartbeat, never from a stored flag that nobody updates.

**Duplicate printing is defended three times:** one job per order, an atomic
`QUEUED → ASSIGNED` claim, and a write-once `printedAt`.

---

## 7. Verifying a deployment

```bash
# Backend suite — 326 passing, 0 failing, 23 skipped (Mongo-only)
cd server && NODE_ENV=test npm test

# Agent suite — 33 passing, including 6 against the live API
cd agent && npm test

# Full 14-point acceptance flow against a running server
node scripts/acceptance.mjs --server https://your-api.example.com

# Frontend
npm run test:routes && npm run test:flow && npm run test:live-api && npm run build
```

`scripts/acceptance.mjs` creates its own shop, machine, document, order and
agent, walks the whole journey over HTTP, and prints what it verified. It expects
`ADMIN_SETUP_KEY` in the environment so it can approve the shop it creates.
