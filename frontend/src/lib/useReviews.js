import { useEffect, useState } from 'react';
import { api } from '../api/client';

// Fetch-once — reviews don't change fast enough to justify polling like
// the market/activity tickers do.
export function useReviews() {
  const [state, setState] = useState({ status: 'loading', reviews: [] });

  useEffect(() => {
    let cancelled = false;
    api
      .getReviews()
      .then((res) => {
        if (!cancelled) setState({ status: 'ok', reviews: res.reviews });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error', reviews: [] });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
