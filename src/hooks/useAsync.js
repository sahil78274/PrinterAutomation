import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Small async data hook with loading/error/refetch handling.
 * Mirrors the ergonomics of a future React Query setup without the dependency.
 */
export function useAsync(fn, deps = [], { immediate = true } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState(null);
  const mounted = useRef(true);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(async (...args) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fnRef.current(...args);
      if (mounted.current) setData(result);
      return result;
    } catch (err) {
      if (mounted.current) setError(err);
      return null;
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (immediate) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, setData, loading, error, refetch: run };
}

/** Re-render a component whenever the shared mock DB changes. */
export function useDbVersion() {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true;
    import('../services/db.js').then(({ subscribe }) => {
      if (!active) return;
      const unsubscribe = subscribe(() => setVersion((v) => v + 1));
      return () => unsubscribe();
    });
    return () => {
      active = false;
    };
  }, []);
  return version;
}
