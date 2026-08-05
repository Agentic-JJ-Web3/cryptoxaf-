import { useCallback, useEffect, useState } from 'react';
import { adminApi, ApiError } from '../../api/client';
import StarRating from '../../components/StarRating';
import { CHAIN_LABELS } from '../../lib/chains';

export default function AdminReviewsPage() {
  const [state, setState] = useState({ status: 'loading', data: null, error: null });
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      const result = await adminApi.listReviews();
      setState({ status: 'ready', data: result, error: null });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Could not load reviews.';
      setState((s) => ({ status: 'error', data: s.data, error: message }));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleModerate(id, action) {
    setBusyId(id);
    try {
      await (action === 'approve' ? adminApi.approveReview(id) : adminApi.rejectReview(id));
      await load();
    } catch (err) {
      setState((s) => ({ ...s, error: err instanceof ApiError ? err.message : 'Could not update this review.' }));
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

  const { reviews, pendingCount } = state.data;

  return (
    <div className="max-w-[640px]">
      <div className="mb-6">
        <div className="tab text-[32px] font-semibold tracking-tight">
          {pendingCount} <span className="text-base font-normal text-muted">waiting for moderation</span>
        </div>
      </div>

      {state.status === 'error' && <div className="mb-4 text-sm text-fault">{state.error}</div>}

      <div className="flex flex-col">
        {reviews.length === 0 && <div className="py-6 text-sm text-muted">Nothing pending.</div>}
        {reviews.map((review) => (
          <div key={review.id} className="border-b border-rule-soft py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <StarRating value={review.rating} />
                <div className="mt-1 font-mono text-xs text-muted">
                  {review.orderReference} · {CHAIN_LABELS[review.chain]}
                </div>
              </div>
              <div className="flex flex-none gap-2">
                <button
                  type="button"
                  disabled={busyId === review.id}
                  onClick={() => handleModerate(review.id, 'reject')}
                  className="rounded-md border border-fault px-3 py-2 text-xs font-semibold text-fault disabled:opacity-60"
                >
                  Reject
                </button>
                <button
                  type="button"
                  disabled={busyId === review.id}
                  onClick={() => handleModerate(review.id, 'approve')}
                  className="rounded-md bg-vault px-3 py-2 text-xs font-semibold text-paper-2 disabled:opacity-60"
                >
                  Approve
                </button>
              </div>
            </div>
            {review.comment && <p className="mt-2.5 text-[13px] leading-relaxed text-ink-2">{review.comment}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
