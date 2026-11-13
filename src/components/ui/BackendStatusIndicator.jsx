import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import { checkBackendHealth } from '../../services/api.js';
import { resolveBaseUrl } from '../../services/apiClient.js';

/**
 * Development-only backend connection indicator.
 *
 * Calls the real `GET /api/health` on the Express server and reports what
 * happened. It deliberately does **not** go through the mock fallback other
 * service functions use: a diagnostic that quietly serves sample data when the
 * server is down would report "connected" while nothing is connected.
 *
 * States:
 *   checking  — request in flight
 *   online    — API answered 200 with a well-formed envelope
 *   degraded  — API answered but is not fully ready (e.g. no database)
 *   offline   — transport failure, timeout or non-2xx response
 *
 * Rendered by main.jsx behind `import.meta.env.DEV`, so it is stripped from
 * production builds entirely.
 */

/** Where the request will actually go, for display alongside the status. */
function describeTarget() {
  const base = resolveBaseUrl();
  return base ? `${base}/api/health` : `${globalThis.location?.origin ?? ''}/api/health`;
}

export default function BackendStatusIndicator() {
  const [state, setState] = useState({ phase: 'checking', data: null, error: null });
  const [attempt, setAttempt] = useState(0);

  const check = useCallback(async () => {
    setState({ phase: 'checking', data: null, error: null });
    try {
      const data = await checkBackendHealth();
      // A reachable API with an unreachable database is still a real answer,
      // and pretending it is healthy would misrepresent the deployment.
      const databaseOk = data?.database?.connected === true;
      setState({
        phase: databaseOk ? 'online' : 'degraded',
        data,
        error: null,
      });
    } catch (error) {
      setState({
        phase: 'offline',
        data: null,
        error: {
          message: error?.message ?? 'Unknown error',
          code: error?.code ?? 'UNKNOWN',
          status: error?.status ?? 0,
          requestId: error?.requestId ?? null,
        },
      });
    }
  }, []);

  useEffect(() => {
    check();
  }, [check, attempt]);

  const { phase, data, error } = state;

  const presentation = {
    checking: {
      icon: Loader2,
      spin: true,
      dot: 'bg-ink-400',
      border: 'border-ink-200',
      bg: 'bg-white',
      title: 'Checking backend…',
      detail: describeTarget(),
    },
    online: {
      icon: CheckCircle2,
      dot: 'bg-success',
      border: 'border-success/30',
      bg: 'bg-success/[0.04]',
      title: 'Backend connected',
      detail: `Express API · ${data?.environment ?? 'unknown'} env · ${data?.database?.name ?? 'database ok'}`,
    },
    degraded: {
      icon: AlertTriangle,
      dot: 'bg-warn',
      border: 'border-warn/30',
      bg: 'bg-warn/[0.05]',
      title: 'Backend up, database unreachable',
      detail: data?.database?.error ?? 'GET /api/health returned an unhealthy database state',
    },
    offline: {
      icon: AlertTriangle,
      dot: 'bg-danger',
      border: 'border-danger/30',
      bg: 'bg-danger/[0.05]',
      title: 'Backend not reachable',
      detail: `${error?.code ?? 'NETWORK_ERROR'} — ${error?.message ?? 'request failed'}`,
    },
  }[phase];

  const Icon = presentation.icon;

  return (
    <div
      role="status"
      aria-live="polite"
      data-backend-status={phase}
      className={`fixed bottom-3 left-3 z-50 flex max-w-[min(22rem,calc(100vw-1.5rem))] items-start gap-2.5 rounded-lg border ${presentation.border} ${presentation.bg} px-3 py-2 shadow-sm backdrop-blur-sm`}
    >
      <Icon
        className={`mt-0.5 size-3.5 shrink-0 ${
          phase === 'online'
            ? 'text-success'
            : phase === 'degraded'
              ? 'text-warn'
              : phase === 'offline'
                ? 'text-danger'
                : 'text-ink-400'
        } ${presentation.spin ? 'animate-spin' : ''}`}
        strokeWidth={2}
        aria-hidden="true"
      />

      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-[11.5px] font-semibold text-ink-700">
          <span
            className={`inline-block size-1.5 rounded-full ${presentation.dot}`}
            aria-hidden="true"
          />
          {presentation.title}
        </p>
        <p
          className="mt-0.5 truncate font-mono text-[10.5px] text-ink-500"
          title={presentation.detail}
        >
          {presentation.detail}
        </p>
        <p className="mt-0.5 truncate font-mono text-[10px] text-ink-400" title={describeTarget()}>
          {describeTarget()}
        </p>
      </div>

      <button
        type="button"
        onClick={() => setAttempt((n) => n + 1)}
        disabled={phase === 'checking'}
        aria-label="Recheck backend connection"
        className="mt-0.5 rounded p-1 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-40"
      >
        <RefreshCw className="size-3" strokeWidth={2.25} aria-hidden="true" />
      </button>
    </div>
  );
}
