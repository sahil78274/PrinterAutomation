/**
 * HTTP client for the print-agent API.
 *
 * Kept deliberately small and dependency-free: the agent ships to shop PCs, and
 * every dependency is something a shop's IT person has to install.
 *
 * The agent key travels in headers, never in a query string, so it cannot end up
 * in a proxy log or a browser history.
 */

export class AgentApiError extends Error {
  constructor(message, { status = 0, code = 'AGENT_API_ERROR', body = null } = {}) {
    super(message);
    this.name = 'AgentApiError';
    this.status = status;
    this.code = code;
    this.body = body;
    // These are worth retrying; a 401 is not.
    this.retryable = status === 0 || status >= 500 || status === 429;
  }
}

export function createApiClient({
  server,
  agentId,
  agentKey,
  timeoutMs = 30_000,
  fetchImpl = fetch,
}) {
  if (!server) throw new Error('createApiClient requires a server URL');

  const base = server.replace(/\/+$/, '');

  function headers(extra = {}) {
    const result = {
      Accept: 'application/json',
      'User-Agent': 'SmartPrintAgent/1.0',
      ...extra,
    };
    if (agentId) result['X-Agent-Id'] = agentId;
    if (agentKey) result['X-Agent-Key'] = agentKey;
    return result;
  }

  async function call(method, path, { body, raw = false, signal } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    // Honour a caller-supplied abort signal as well as the timeout.
    if (signal) signal.addEventListener('abort', () => controller.abort(), { once: true });

    try {
      const response = await fetchImpl(`${base}${path}`, {
        method,
        headers: headers(body ? { 'Content-Type': 'application/json' } : {}),
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      // 204 means "no work right now" — a normal, frequent answer.
      if (response.status === 204) return null;

      if (raw && response.ok) {
        return {
          bytes: Buffer.from(await response.arrayBuffer()),
          contentType: response.headers.get('content-type'),
        };
      }

      const text = await response.text();
      const payload = text ? safeJson(text) : null;

      if (!response.ok) {
        const error = payload?.error ?? {};
        throw new AgentApiError(error.message ?? `Request failed (${response.status})`, {
          status: response.status,
          code: error.code ?? `HTTP_${response.status}`,
          body: payload,
        });
      }

      // Unwrap the shared API envelope when present.
      return payload?.data !== undefined ? payload.data : payload;
    } catch (error) {
      if (error instanceof AgentApiError) throw error;
      if (error.name === 'AbortError') {
        throw new AgentApiError(`Request to ${path} timed out`, { code: 'TIMEOUT' });
      }
      // A network failure is retryable: the shop's broadband drops.
      throw new AgentApiError(`Could not reach the server: ${error.message}`, {
        code: 'NETWORK_ERROR',
        body: { cause: error.message },
      });
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    server: base,

    heartbeat(payload = {}) {
      return call('POST', '/api/agents/heartbeat', { body: payload });
    },

    nextJob() {
      return call('GET', '/api/agents/jobs/next');
    },

    downloadDocument(jobId) {
      return call('GET', `/api/agents/jobs/${jobId}/document`, { raw: true });
    },

    markDownloading(jobId) {
      return call('POST', `/api/agents/jobs/${jobId}/downloading`);
    },

    startPrinting(jobId, { idempotencyKey }) {
      // The key makes a retried request safe: the server writes printedAt once.
      return call('POST', `/api/agents/jobs/${jobId}/printing`, {
        body: { idempotencyKey },
      });
    },

    completeJob(jobId, payload = {}) {
      return call('POST', `/api/agents/jobs/${jobId}/complete`, { body: payload });
    },

    failJob(jobId, payload = {}) {
      return call('POST', `/api/agents/jobs/${jobId}/fail`, { body: payload });
    },

    /** Raw call, for tests and for the doctor command. */
    call,
  };
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return { error: { message: text.slice(0, 200) } };
  }
}

export default createApiClient;
