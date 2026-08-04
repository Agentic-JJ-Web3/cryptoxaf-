import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../api/client';

const DEBOUNCE_MS = 400;

// Backs the live-updating quote on the swap screen. Debounced and
// request-ID-guarded so a slow, stale response can't clobber a newer one
// after the customer kept typing.
export function useQuotePreview({ xafAmount, destinationAddress }) {
  const [state, setState] = useState({ status: 'idle', data: null, error: null });
  const timerRef = useRef(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    clearTimeout(timerRef.current);

    if (!destinationAddress.trim() && !xafAmount) {
      requestIdRef.current += 1;
      setState({ status: 'idle', data: null, error: null });
      return undefined;
    }

    setState((s) => ({ ...s, status: 'loading' }));
    const requestId = ++requestIdRef.current;

    timerRef.current = setTimeout(async () => {
      try {
        const data = await api.previewQuote({ xafAmount, destinationAddress });
        if (requestIdRef.current !== requestId) return;
        setState({ status: 'ready', data, error: null });
      } catch (err) {
        if (requestIdRef.current !== requestId) return;
        setState({
          status: 'error',
          data: null,
          error: err instanceof ApiError ? err.message : 'Something went wrong',
        });
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timerRef.current);
  }, [xafAmount, destinationAddress]);

  return state;
}
