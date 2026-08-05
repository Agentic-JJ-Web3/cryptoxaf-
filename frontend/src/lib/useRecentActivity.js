import { useEffect, useState } from 'react';
import { api } from '../api/client';

const REFRESH_MS = 30_000;

// Mirrors useMarketTicker.js's polling shape. `minutesAgo` from the server
// is only as fresh as the last poll — close enough for a ticker line, not
// worth a client-side per-second recompute the way the order-status page's
// elapsed timer needs.
export function useRecentActivity() {
  const [state, setState] = useState({ status: 'loading', activity: [] });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await api.getActivity();
        if (!cancelled) setState({ status: 'ok', activity: res.activity });
      } catch {
        if (!cancelled) setState((s) => ({ ...s, status: 'error' }));
      }
    }

    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  return state;
}
