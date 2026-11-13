/**
 * HTTP client for the SmartPrint API.
 *
 * Responsibilities, and deliberately nothing else:
 *  - resolve the base URL (explicit env → dev proxy → same origin)
 *  - attach the bearer token, if one exists
 *  - unwrap the `{ success, data }` envelope
 *  - normalise failures into a single `ApiClientError` shape the UI can render
 *  - time out requests so a dead backend can never hang a spinner forever
 *
 * It knows nothing about printers, orders or pricing. That keeps the mock layer
 * and the real layer interchangeable (see `api.js`).
 *
 * Contract (from docs/ARCHITECTURE.md):
 *   success  { success: true, data, meta? }
 *   failure  { success: false, error: { code, message, details? }, requestId }
 */

const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * Empty base URL means "same origin", which is what the Vite dev proxy and a
 * production reverse proxy both want. Falling back to absolute localhost URLs
 * here would break every deployment behind a proxy.
 */
export function resolveBaseUrl() {
  const configured = import.meta.env?.VITE_API_BASE_URL;
  if (configured) return String(configured).replace(/\/+$/, '');
  return '';
}

export class ApiClientError extends Error {
  constructor(
    message,
    { status = 0, code = 'NETWORK_ERROR', details = null, requestId = null } = {},
  ) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
    /** True when the backend refused us for auth reasons; the UI logs out. */
    this.isAuthError = status === 401 || status === 403;
  }
}

/* --------------------------------------------------------------- token --- */

const SESSION_STORAGE_KEY = 'smartprint.session.v1';

/**
 * Read the token lazily from storage rather than holding it in module state:
 * a logout in another tab must take effect on the next request.
 */
export function getStoredToken() {
  try {
    const raw = globalThis.localStorage?.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw)?.token ?? null;
  } catch {
    return null;
  }
}

/** Registered by the auth layer so a 401 can clear the session exactly once. */
let unauthorizedHandler = null;

export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = typeof handler === 'function' ? handler : null;
}

/* ------------------------------------------------------------- request --- */

async function parseBody(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    // A proxy or load balancer returning HTML should not crash the UI.
    return { __raw: text };
  }
}

/**
 * Perform a request and return the unwrapped payload.
 *
 * @param {string} path      Path beginning with `/`, e.g. `/api/machines/SP-001`.
 * @param {object} [options]
 * @param {string} [options.method]
 * @param {object} [options.body]
 * @param {object} [options.query]       Appended, skipping null/undefined/''.
 * @param {AbortSignal} [options.signal] Caller-owned cancellation.
 * @param {number} [options.timeoutMs]
 * @param {boolean} [options.auth]       Send the bearer token (default true).
 * @param {boolean} [options.raw]        Return the whole envelope, meta included.
 */
export async function request(path, options = {}) {
  const {
    method = 'GET',
    body,
    query,
    signal,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    auth = true,
    raw = false,
    headers: extraHeaders,
  } = options;

  const base = resolveBaseUrl();
  const url = new URL(`${base}${path}`, globalThis.location?.origin ?? 'http://localhost');

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null || value === '') continue;
    url.searchParams.set(key, String(value));
  }

  const headers = { Accept: 'application/json', ...extraHeaders };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  if (auth) {
    const token = getStoredToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  // Caller cancellation and our timeout must both work; combine them.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort('timeout'), timeoutMs);
  const onCallerAbort = () => controller.abort('caller');
  signal?.addEventListener('abort', onCallerAbort, { once: true });

  let response;
  try {
    response = await fetch(url.toString(), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
      // Cookies are not used for auth (bearer tokens are), and sending them
      // cross-origin would need credentials the API does not accept.
      credentials: 'same-origin',
    });
  } catch (error) {
    if (signal?.aborted) {
      throw new ApiClientError('Request cancelled', { code: 'ABORTED' });
    }
    if (controller.signal.reason === 'timeout') {
      throw new ApiClientError(`The server took too long to respond (${timeoutMs}ms).`, {
        code: 'TIMEOUT',
      });
    }
    throw new ApiClientError('Cannot reach the server. Check your connection and try again.', {
      code: 'NETWORK_ERROR',
    });
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener('abort', onCallerAbort);
  }

  const payload = await parseBody(response);

  if (!response.ok) {
    const error = payload?.error ?? {};
    const apiError = new ApiClientError(
      error.message || `Request failed with status ${response.status}`,
      {
        status: response.status,
        code: error.code || 'HTTP_ERROR',
        details: error.details ?? null,
        requestId: payload?.requestId ?? response.headers.get('x-request-id') ?? null,
      },
    );

    if (apiError.isAuthError) unauthorizedHandler?.();
    throw apiError;
  }

  if (payload?.success === true) {
    return raw ? payload : (payload.data ?? null);
  }

  // A 200 that is not the documented envelope means something in front of the
  // API answered — surface it rather than returning a half-parsed object.
  throw new ApiClientError('Unexpected response from the server.', {
    status: response.status,
    code: 'MALFORMED_RESPONSE',
    details: payload?.__raw ? payload.__raw.slice(0, 200) : null,
  });
}

/** Thin verb helpers — most call sites read better with these. */
export const apiClient = {
  get: (path, options) => request(path, { ...options, method: 'GET' }),
  post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
  patch: (path, body, options) => request(path, { ...options, method: 'PATCH', body }),
  put: (path, body, options) => request(path, { ...options, method: 'PUT', body }),
  delete: (path, options) => request(path, { ...options, method: 'DELETE' }),
};

export default apiClient;
