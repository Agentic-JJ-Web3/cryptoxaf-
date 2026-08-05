import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Masthead from '../components/Masthead';
import BackButton from '../components/BackButton';
import { api } from '../api/client';
import { formatXaf, headTail } from '../lib/format';
import { CHAIN_LABELS } from '../lib/chains';
import { stageFromStatus } from '../lib/orderStage';
import { getOrderHistory, getSavedAddresses, saveOrderToHistory, clearHistory } from '../lib/orderHistory';

const STAGE_META = {
  waiting: { label: 'Waiting for payment', color: 'var(--muted)' },
  checking: { label: 'Checking payment', color: 'var(--muted)' },
  sent: { label: 'USDT sent', color: 'var(--live)' },
  refund: { label: 'Refund sent', color: 'var(--fault)' },
  expired: { label: 'Expired', color: 'var(--muted)' },
};

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function OrderHistoryPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState(() => getOrderHistory());
  const [addresses] = useState(() => getSavedAddresses());
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [cleared, setCleared] = useState(false);

  // Refresh each stored order's status from the server so the list
  // reflects reality even though the underlying record is device-local.
  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      const stored = getOrderHistory();
      const results = await Promise.all(
        stored.map(async (o) => {
          try {
            const { order } = await api.getOrder(o.reference);
            return { ...o, status: order.status };
          } catch {
            return o;
          }
        }),
      );
      if (cancelled) return;
      results.forEach((o) => saveOrderToHistory(o));
      setOrders(results);
    }

    refresh();
    return () => {
      cancelled = true;
    };
  }, []);

  function handleUseAddress(address) {
    navigate(`/swap?address=${encodeURIComponent(address)}`);
  }

  function handleConfirmClear() {
    clearHistory();
    setConfirmingClear(false);
    setCleared(true);
  }

  const hasHistory = !cleared && (orders.length > 0 || addresses.length > 0);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col px-5 pb-10 text-ink">
      <Masthead />

      <div className="pt-4">
        <BackButton />
      </div>

      <div className="border-b border-rule-soft py-4">
        <h1 className="text-[19px] font-semibold text-ink">Order history</h1>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          Stored on this device only — there is no account, so nothing is saved on a server. Clearing your
          browser data or switching phones clears this list.
        </p>
      </div>

      {!hasHistory && (
        <div className="py-10 text-center">
          <div className="text-[15px] font-semibold text-ink">No orders yet on this device</div>
          <p className="mx-auto mt-2 mb-5 max-w-[32ch] text-[13px] leading-relaxed text-ink-2">
            Your first swap will show up here, along with any wallet address you use, ready to reuse next
            time.
          </p>
          <Link
            to="/swap"
            className="inline-block rounded-md bg-vault px-5.5 py-3 text-sm font-semibold text-paper-2"
          >
            Make your first order
          </Link>
        </div>
      )}

      {hasHistory && (
        <>
          {addresses.length > 0 && (
            <div className="border-b border-rule-soft py-5">
              <div className="mb-3 font-mono text-[11px] uppercase tracking-wider text-muted">Saved addresses</div>
              <div className="flex flex-col gap-2">
                {addresses.map((a) => {
                  const { head, tail } = headTail(a.address);
                  const mid = a.address.slice(6, -6);
                  return (
                    <div
                      key={a.address}
                      className="flex items-center gap-3 rounded-lg border border-rule bg-card px-3.5 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <span
                          className="rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-vault"
                          style={{ borderColor: 'var(--vault)', background: 'rgba(63,208,143,.1)' }}
                        >
                          {CHAIN_LABELS[a.chain]}
                        </span>
                        <div className="mt-1.5 break-all font-mono text-[13px]">
                          <span className="font-medium text-ink">{head}</span>
                          <span style={{ color: 'var(--rule)' }}>{mid}</span>
                          <span className="font-medium text-ink">{tail}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleUseAddress(a.address)}
                        className="flex-none rounded-md border border-rule bg-paper-2 px-3.5 py-2 text-xs font-semibold text-ink-2"
                      >
                        Use
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {orders.length > 0 && (
            <div className="border-b border-rule-soft py-5">
              <div className="mb-3 font-mono text-[11px] uppercase tracking-wider text-muted">Past orders</div>
              <div className="flex flex-col">
                {orders.map((o) => {
                  const meta = STAGE_META[stageFromStatus(o.status)];
                  return (
                    <button
                      key={o.reference}
                      type="button"
                      onClick={() => navigate(`/order/${o.reference}`)}
                      className="flex items-center justify-between gap-3 border-b border-rule-soft py-3.5 text-left"
                    >
                      <div className="min-w-0">
                        <div className="font-mono text-[13px] font-medium text-ink">{o.reference}</div>
                        <div className="tab mt-1 text-xs text-muted">
                          {formatDate(o.createdAt)} · {formatXaf(o.xafAmount)} XAF · {CHAIN_LABELS[o.chain]}
                        </div>
                      </div>
                      <div className="flex-none text-xs font-semibold" style={{ color: meta.color }}>
                        {meta.label}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="pt-4">
            {!confirmingClear ? (
              <button
                type="button"
                onClick={() => setConfirmingClear(true)}
                className="text-[13px] font-medium text-muted underline"
              >
                Clear history on this device
              </button>
            ) : (
              <div className="rounded-lg border border-rule bg-card px-4 py-3.5">
                <p className="mb-3 text-[13px] leading-relaxed text-ink-2">
                  Clear all saved addresses and past orders on this device. This can&rsquo;t be undone.
                </p>
                <div className="flex gap-2.5">
                  <button
                    type="button"
                    onClick={() => setConfirmingClear(false)}
                    className="flex-1 rounded-md border border-rule bg-paper-2 py-3 text-[13px] font-medium text-ink-2"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmClear}
                    className="flex-1 rounded-md bg-fault py-3 text-[13px] font-semibold text-white"
                  >
                    Clear everything
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
