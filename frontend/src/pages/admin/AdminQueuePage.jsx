import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi, ApiError } from '../../api/client';
import { formatXaf, formatUsdtBaseUnits, formatElapsedMinutes } from '../../lib/format';
import { adminStateMeta, elapsedColor } from '../../lib/adminOrderState';

const POLL_MS = 6000;

export default function AdminQueuePage() {
  const navigate = useNavigate();
  const [state, setState] = useState({ status: 'loading', data: null, error: null });
  const pollRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const result = await adminApi.listQueue();
        if (cancelled) return;
        setState({ status: 'ready', data: result, error: null });
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof ApiError ? err.message : 'Could not load the queue.';
        setState((s) => ({ status: 'error', data: s.data, error: message }));
      }
    }

    load();
    pollRef.current = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(pollRef.current);
    };
  }, []);

  if (state.status === 'loading') {
    return <div className="text-sm text-muted">Loading queue…</div>;
  }

  if (!state.data) {
    return <div className="text-sm text-fault">{state.error}</div>;
  }

  const { orders, actionCount, totalCount, todayStats } = state.data;

  return (
    <div>
      {state.status === 'error' && <div className="mb-4 text-sm text-fault">{state.error}</div>}

      <div className="mb-6">
        <div className="tab text-[32px] font-semibold tracking-tight">
          {actionCount} <span className="text-base font-normal text-muted">need action</span>
        </div>
        <div className="mt-1 text-xs text-muted">{totalCount} in queue · oldest first</div>
      </div>

      <div className="mb-6 border-b border-rule pb-4">
        <div className="mb-2.5 font-mono text-[10px] uppercase tracking-wider text-muted">Today</div>
        <StatRow label="Orders settled" value={todayStats.ordersSettled} />
        <StatRow label="XAF collected" value={formatXaf(todayStats.xafCollected)} />
        <StatRow label="USDT sent" value={formatUsdtBaseUnits(todayStats.usdtSentMicros, 6)} />
      </div>

      <div className="flex flex-col">
        {orders.length === 0 && <div className="py-6 text-sm text-muted">Nothing in the queue.</div>}
        {orders.map((order) => (
          <QueueRow key={order.reference} order={order} onClick={() => navigate(`/admin/orders/${order.reference}`)} />
        ))}
      </div>
    </div>
  );
}

function StatRow({ label, value }) {
  return (
    <div className="flex items-baseline py-[3px] text-[13px]">
      <span className="whitespace-nowrap text-muted">{label}</span>
      <span
        className="mx-2 min-w-[14px] flex-1 border-b border-dotted border-rule"
        style={{ transform: 'translateY(-4px)' }}
      />
      <span className="tab whitespace-nowrap text-ink-2">{value}</span>
    </div>
  );
}

function QueueRow({ order, onClick }) {
  const meta = adminStateMeta(order.status);
  const elapsedMs = Math.max(0, Date.now() - new Date(order.createdAt).getTime());
  const minutes = Math.floor(elapsedMs / 60000);

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3.5 border-b border-rule-soft py-4 text-left"
    >
      <div className="w-16 flex-none">
        <div className="tab font-mono text-[22px] font-semibold" style={{ color: elapsedColor(minutes) }}>
          {formatElapsedMinutes(elapsedMs)}
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span
            className="flex-none rounded border px-1 py-0.5 text-[9px] font-semibold leading-none"
            style={{
              borderColor: order.direction === 'SELL' ? 'var(--fee)' : 'var(--vault)',
              color: order.direction === 'SELL' ? 'var(--fee)' : 'var(--vault)',
            }}
          >
            {order.direction}
          </span>
          <div className="font-mono text-sm font-medium text-ink">{order.reference}</div>
        </div>
        <div className="tab mt-0.5 text-xs text-muted">
          {formatXaf(order.xafAmount)} XAF · {order.chain === 'TRON' ? 'TRC-20' : 'BEP-20'}
        </div>
        <div className="mt-0.5 text-xs" style={{ color: meta.color, fontWeight: meta.weight }}>
          {meta.label}
        </div>
      </div>
      <div className="flex-none text-base text-rule">&rsaquo;</div>
    </button>
  );
}
