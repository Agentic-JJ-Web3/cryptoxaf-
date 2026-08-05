import { useCallback, useEffect, useState } from 'react';
import { adminApi, ApiError } from '../../api/client';

export default function AdminNotifyPage() {
  const [state, setState] = useState({ status: 'loading', data: null, error: null });
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      const result = await adminApi.listNotifyRequests();
      setState({ status: 'ready', data: result, error: null });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Could not load notify requests.';
      setState((s) => ({ status: 'error', data: s.data, error: message }));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleMarkNotified(id) {
    setBusyId(id);
    try {
      await adminApi.markNotified(id);
      await load();
    } catch (err) {
      setState((s) => ({ ...s, error: err instanceof ApiError ? err.message : 'Could not mark this as notified.' }));
    } finally {
      setBusyId(null);
    }
  }

  if (state.status === 'loading') {
    return <div className="text-sm text-muted">Loading…</div>;
  }
  if (!state.data) {
    return <div className="text-sm text-fault">{state.error}</div>;
  }

  const { requests, pendingCount } = state.data;

  return (
    <div className="max-w-[560px]">
      <div className="mb-6">
        <div className="tab text-[32px] font-semibold tracking-tight">
          {pendingCount} <span className="text-base font-normal text-muted">waiting to be told we've reopened</span>
        </div>
        <div className="mt-1 text-xs text-muted">{requests.length} total request{requests.length === 1 ? '' : 's'}</div>
      </div>

      {state.status === 'error' && <div className="mb-4 text-sm text-fault">{state.error}</div>}

      <div className="flex flex-col">
        {requests.length === 0 && <div className="py-6 text-sm text-muted">No notify requests yet.</div>}
        {requests.map((r) => (
          <div key={r.id} className="flex items-center justify-between gap-3 border-b border-rule-soft py-4">
            <div>
              <div className="tab text-sm font-medium text-ink">{r.phone}</div>
              <div className="mt-0.5 text-xs text-muted">
                Requested {new Date(r.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
              </div>
            </div>
            {r.notifiedAt ? (
              <div className="flex-none text-xs font-medium text-live">
                Notified {new Date(r.notifiedAt).toLocaleDateString([], { dateStyle: 'medium' })}
              </div>
            ) : (
              <button
                type="button"
                disabled={busyId === r.id}
                onClick={() => handleMarkNotified(r.id)}
                className="flex-none rounded-md border border-rule bg-card px-3.5 py-2 text-xs font-semibold text-ink-2 hover:border-ink-2 disabled:opacity-60"
              >
                {busyId === r.id ? 'Marking…' : 'Mark notified'}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
