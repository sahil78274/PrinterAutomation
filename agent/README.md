# SmartPrint Local Print Agent

Runs on the shop's Windows PC and turns paid print jobs into printed pages.

## What it does

1. Registers once with the platform and receives an **agent key** (shown once).
2. Heartbeats every 15 seconds so the shop dashboard knows the machine is online.
3. Polls for the next job, claims it, downloads the PDF, prints it, and reports
   the outcome.

## Requirements

- **Windows** for real printing — the spooler is a Windows API.
- Node.js 18 or newer.
- A printer **installed and working in Windows**. The agent does not install
  drivers and cannot print to a printer Windows does not know about.

## Install

```powershell
cd agent
npm install
```

## Register

Run once, on the machine that owns the printer. Get the machine ID from the shop
dashboard (e.g. `SP-001`) and an owner access token.

```powershell
npm run register -- --server https://your-api.example.com --machine SP-001 --token <owner-access-token>
```

The agent key is printed **once**. It is stored hashed on the server and cannot
be retrieved again — if it is lost, revoke the agent and register a new one.

Registration writes `agent.config.json` in the current directory. **Keep that
file private: it contains the agent key.** It is already covered by
`.gitignore`.

## Run

```powershell
npm start
```

## Virtual Printer Mode

For development and demos on a machine with **no printer**:

```powershell
$env:SMARTPRINT_PRINT_MODE="virtual"
npm start
```

In virtual mode the agent downloads the real document, validates it, and then
**simulates** printing by writing a receipt to `./virtual-prints/`. Nothing is
sent to any printer. Every job is marked `simulated: true` on the server and
shown as simulated in the dashboards.

**Virtual mode is not printing.** It exists so the order → payment → job pipeline
can be exercised end to end without hardware.

## Physical printing: what has and has not been verified

The server side of the pipeline — claiming, downloading, state transitions,
idempotency, duplicate prevention — is covered by executed tests.

The Windows spooler call itself is **not verified here**. This build environment
has no Windows machine and no printer. Before relying on it:

1. Install a printer in Windows and confirm it prints a test page.
2. Run `npm run doctor` to confirm the agent can see the printer.
3. Print one real job and watch the page come out.

Until step 3 is done on your hardware, treat physical printing as unverified.

## Configuration

| Setting        | Env var                   | Default                 |
| -------------- | ------------------------- | ----------------------- |
| API base URL   | `SMARTPRINT_SERVER`       | from config file        |
| Agent ID       | `SMARTPRINT_AGENT_ID`     | from config file        |
| Agent key      | `SMARTPRINT_AGENT_KEY`    | from config file        |
| Print mode     | `SMARTPRINT_PRINT_MODE`   | `real`                  |
| Printer name   | `SMARTPRINT_PRINTER`      | Windows default printer |
| Poll interval  | `SMARTPRINT_POLL_MS`      | `3000`                  |
| Heartbeat      | `SMARTPRINT_HEARTBEAT_MS` | `15000`                 |
| Data directory | `SMARTPRINT_DATA_DIR`     | `./data`                |

## Safety behaviour

- **One job at a time.** The agent never overlaps prints.
- **No duplicate printing.** A job is only printed after the server grants the
  claim, and the print call carries a write-once timestamp on the server.
- **Crash recovery.** On restart, an in-flight job is reported to the server as
  failed rather than silently leaked, and the server's retry limit applies.
- **Document deletion.** The downloaded PDF is deleted from disk as soon as the
  job finishes, whether it printed or failed.
- **Backoff.** A server outage does not hammer the API: the poll interval backs
  off up to 60 seconds and resets on success.
