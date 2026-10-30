import { useCallback, useEffect, useRef, useState } from 'react';
import api, { errorMessage } from '../services/api';

/**
 * Load data from a GET endpoint. Returns { data, loading, error, reload, setData }.
 * Pass null as the url to skip loading.
 */
export function useApi(url, { initial = null, params } = {}) {
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(Boolean(url));
  const [error, setError] = useState(null);
  const paramsKey = JSON.stringify(params || {});
  const seq = useRef(0);

  const reload = useCallback(async () => {
    if (!url) return null;
    const mySeq = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(url, { params: JSON.parse(paramsKey) });
      if (mySeq === seq.current) setData(res.data);
      return res.data;
    } catch (err) {
      if (mySeq === seq.current) setError(errorMessage(err));
      return null;
    } finally {
      if (mySeq === seq.current) setLoading(false);
    }
  }, [url, paramsKey]);

  useEffect(() => { reload(); }, [reload]);

  return { data, loading, error, reload, setData };
}

/** Wrap a mutating call with a busy flag. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const run = useCallback(async (fn) => {
    setBusy(true);
    try {
      return await fn();
    } finally {
      setBusy(false);
    }
  }, []);
  return [busy, run];
}
