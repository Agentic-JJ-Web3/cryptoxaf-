import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';

const REFRESH_MS = 30_000;

// Drives the swap screen's live-rate strip: fetches the market rate (and
// both chains' flat fees, for the fee-comparison cards) on mount, then
// refreshes periodically and ticks a "Ns ago" counter every second.
export function useMarketTicker() {
  const [state, setState] = useState({
    status: 'loading',
    marketRateMicros: null,
    tronNetworkFeeXaf: null,
    bscNetworkFeeXaf: null,
    isOpen: null,
    reopenLabel: null,
    secondsAgo: 0,
  });
  const fetchedAtRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await api.getMarketRate();
        if (cancelled) return;
        fetchedAtRef.current = Date.now();
        setState({
          status: 'ok',
          marketRateMicros: res.marketRateMicros,
          tronNetworkFeeXaf: res.tronNetworkFeeXaf,
          bscNetworkFeeXaf: res.bscNetworkFeeXaf,
          isOpen: res.isOpen,
          reopenLabel: res.reopenLabel,
          secondsAgo: 0,
        });
      } catch {
        if (cancelled) return;
        setState((s) => ({ ...s, status: 'unavailable' }));
      }
    }

    load();
    const refreshTimer = setInterval(load, REFRESH_MS);
    const tickTimer = setInterval(() => {
      setState((s) =>
        s.status === 'ok' && fetchedAtRef.current
          ? { ...s, secondsAgo: Math.floor((Date.now() - fetchedAtRef.current) / 1000) }
          : s,
      );
    }, 1000);

    return () => {
      cancelled = true;
      clearInterval(refreshTimer);
      clearInterval(tickTimer);
    };
  }, []);

  return state;
}
