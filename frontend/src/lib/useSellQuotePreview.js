import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../api/client';

const DEBOUNCE_MS = 400;

// Sell's mirror of useQuotePreview — same debounce/request-guard shape,
// but chain is always an explicit selection here (see CLAUDE.md "Sell
// flow"), not detected from an address.
export function useSellQuotePreview({ usdtAmount, chain }) {
  const [state, setState] = useState({ status: 'idle', data: null, error: null });
  const timerRef = useRef(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    clearTimeout(timerRef.current);

    if (!usdtAmount.trim() && !chain) {
      requestIdRef.current += 1;
      setState({ status: 'idle', data: null, error: null });
      return undefined;
    }

    setState((s) => ({ ...s, status: 'loading' }));
    const requestId = ++requestIdRef.current;

    timerRef.current = setTimeout(async () => {
      try {
        const data = await api.previewSellQuote({ usdtAmount, chain });
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
  }, [usdtAmount, chain]);

  return state;
}
