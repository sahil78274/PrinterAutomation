/**
 * Minimal structured logger — no external dependency.
 *
 * Levels: error > warn > info > debug > off
 * In production output is single-line JSON so it can be ingested by a log
 * collector; in development it is human-readable and colourised.
 */

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3, off: 99 };

const COLOURS = {
  error: '\x1b[31m',
  warn: '\x1b[33m',
  info: '\x1b[36m',
  debug: '\x1b[90m',
  reset: '\x1b[0m',
  dim: '\x1b[2m',
};

const isProd = process.env.NODE_ENV === 'production';

function createLogger(level = 'info') {
  const threshold = LEVELS[level] ?? LEVELS.info;

  const emit = (levelName, message, meta) => {
    if (LEVELS[levelName] > threshold || levelName === 'off') return;

    const timestamp = new Date().toISOString();

    if (isProd) {
      const payload = { timestamp, level: levelName, message };
      if (meta !== undefined) payload.meta = meta;
      const line = JSON.stringify(payload);
      if (levelName === 'error') console.error(line);
      else if (levelName === 'warn') console.warn(line);
      else console.log(line);
      return;
    }

    const colour = COLOURS[levelName] ?? '';
    const label = levelName.toUpperCase().padEnd(5);
    const prefix = `${COLOURS.dim}${timestamp.slice(11, 19)}${COLOURS.reset} ${colour}${label}${COLOURS.reset}`;
    const suffix = meta !== undefined ? ` ${COLOURS.dim}${formatMeta(meta)}${COLOURS.reset}` : '';
    const output = `${prefix} ${message}${suffix}`;

    if (levelName === 'error') console.error(output);
    else if (levelName === 'warn') console.warn(output);
    else console.log(output);
  };

  return {
    level,
    error: (message, meta) => emit('error', message, meta),
    warn: (message, meta) => emit('warn', message, meta),
    info: (message, meta) => emit('info', message, meta),
    debug: (message, meta) => emit('debug', message, meta),
    /** Child logger that prefixes every message, e.g. for a request id. */
    child: (scope) => {
      const prefixed = (fn) => (message, meta) => fn(`[${scope}] ${message}`, meta);
      return {
        level,
        error: prefixed(emit.bind(null, 'error')),
        warn: prefixed(emit.bind(null, 'warn')),
        info: prefixed(emit.bind(null, 'info')),
        debug: prefixed(emit.bind(null, 'debug')),
        child: (childScope) => createLogger(level).child(`${scope}:${childScope}`),
      };
    },
  };
}

function formatMeta(meta) {
  if (meta instanceof Error) return meta.stack ?? meta.message;
  try {
    const json = JSON.stringify(meta);
    return json.length > 400 ? `${json.slice(0, 400)}…` : json;
  } catch {
    return String(meta);
  }
}

const logger = createLogger();

export { createLogger };
export default logger;
