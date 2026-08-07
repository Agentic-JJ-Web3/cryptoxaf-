import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi, ApiError } from '../../api/client';
import { formatXaf, formatUsdtBaseUnits } from '../../lib/format';
import { adminStateMeta } from '../../lib/adminOrderState';

const PAGE_SIZE = 25;

const STATUS_OPTIONS = [
  'QUOTED',
  'AWAITING_PAYMENT',
  'PAYMENT_CLAIMED',
  'PAYMENT_VERIFIED',
  'AWAITING_DEPOSIT',
  'DEPOSIT_CLAIMED',
  'DEPOSIT_VERIFIED',
  'COMPLETED',
  'EXPIRED',
  'REFUND_DUE',
  'REFUNDED',
];

const EMPTY_FILTERS = { direction: '', status: '', dateFrom: '', dateTo: '' };

export default function AdminHistoryPage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [offset, setOffset] = useState(0);
  const [state, setState] = useState({ status: 'loading', data: null, error: null });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, status: 'loading' }));
    try {
      const result = await adminApi.getOrderHistory({ ...filters, limit: PAGE_SIZE, offset });
      setState({ status: 'ready', data: result, error: null });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Could not load order history.';
      setState((s) => ({ status: 'error', data: s.data, error: message }));
    }
  }, [filters, offset]);

  useEffect(() => {
    load();
  }, [load]);

  function updateFilter(key, value) {
    setOffset(0);
    setFilters((f) => ({ ...f, [key]: value }));
  }

  const orders = state.data?.orders ?? [];
  const totalCount = state.data?.totalCount ?? 0;
  const hasNext = offset + PAGE_SIZE < totalCount;
  const hasPrev = offset > 0;

  return (
    <div>
      <div className="mb-6">
        <div className="text-[19px] font-semibold">Order history</div>
        <p className="mt-1.5 text-xs text-muted">Every order, including settled and expired — the queue only shows what still needs attention.</p>
      </div>

      <div className="mb-5 flex flex-wrap gap-2.5 border-b border-rule pb-5">
        <FilterSelect
          label="Type"
          value={filters.direction}
          onChange={(v) => updateFilter('direction', v)}
          options={[
            { value: '', label: 'All types' },
            { value: 'BUY', label: 'Buy' },
            { value: 'SELL', label: 'Sell' },
          ]}
        />
        <FilterSelect
          label="Status"
          value={filters.status}
          onChange={(v) => updateFilter('status', v)}
          options={[{ value: '', label: 'All statuses' }, ...STATUS_OPTIONS.map((s) => ({ value: s, label: s }))]}
        />
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider text-muted">From</span>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => updateFilter('dateFrom', e.target.value)}
            className="rounded-md border border-rule bg-card px-2.5 py-1.5 text-xs text-ink outline-none"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider text-muted">To</span>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => updateFilter('dateTo', e.target.value)}
            className="rounded-md border border-rule bg-card px-2.5 py-1.5 text-xs text-ink outline-none"
          />
        </label>
        {(filters.direction || filters.status || filters.dateFrom || filters.dateTo) && (
          <button
            type="button"
            onClick={() => {
              setOffset(0);
              setFilters(EMPTY_FILTERS);
            }}
            className="mt-auto rounded-md border border-rule bg-card px-3 py-1.5 text-xs font-medium text-ink-2 hover:border-ink-2"
          >
            Clear filters
          </button>
        )}
      </div>

      {state.status === 'error' && <div className="mb-4 text-sm text-fault">{state.error}</div>}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b border-rule text-[10px] uppercase tracking-wider text-muted">
              <th className="py-2 pr-3 font-medium">Reference</th>
              <th className="py-2 pr-3 font-medium">Type</th>
              <th className="py-2 pr-3 font-medium">Status</th>
              <th className="py-2 pr-3 font-medium">Chain</th>
              <th className="py-2 pr-3 font-medium">XAF</th>
              <th className="py-2 pr-3 font-medium">USDT</th>
              <th className="py-2 font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 && state.status !== 'loading' && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-muted">
                  No orders match these filters.
                </td>
              </tr>
            )}
            {orders.map((order) => {
              const meta = adminStateMeta(order.status);
              return (
                <tr
                  key={order.reference}
                  onClick={() => navigate(`/admin/orders/${order.reference}`)}
                  className="cursor-pointer border-b border-rule-soft hover:bg-paper-2"
                >
                  <td className="py-2.5 pr-3 font-mono text-ink">{order.reference}</td>
                  <td className="py-2.5 pr-3">
                    <span
                      className="rounded border px-1 py-0.5 text-[9px] font-semibold"
                      style={{
                        borderColor: order.direction === 'SELL' ? 'var(--fee)' : 'var(--vault)',
                        color: order.direction === 'SELL' ? 'var(--fee)' : 'var(--vault)',
                      }}
                    >
                      {order.direction}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3" style={{ color: meta.color, fontWeight: meta.weight }}>
                    {meta.label}
                  </td>
                  <td className="py-2.5 pr-3 text-ink-2">{order.chain === 'TRON' ? 'TRC-20' : 'BEP-20'}</td>
                  <td className="tab py-2.5 pr-3 text-ink-2">{formatXaf(order.xafAmount)}</td>
                  <td className="tab py-2.5 pr-3 text-ink-2">{formatUsdtBaseUnits(order.usdtAmount, order.chain === 'TRON' ? 6 : 18)}</td>
                  <td className="tab py-2.5 text-muted">{new Date(order.createdAt).toLocaleDateString([], { dateStyle: 'medium' })}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-muted">
        <span>
          {totalCount === 0 ? '0 orders' : `${offset + 1}–${Math.min(offset + PAGE_SIZE, totalCount)} of ${totalCount}`}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={!hasPrev}
            onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
            className="rounded-md border border-rule bg-card px-3 py-1.5 font-medium text-ink-2 disabled:opacity-40"
          >
            Previous
          </button>
          <button
            type="button"
            disabled={!hasNext}
            onClick={() => setOffset((o) => o + PAGE_SIZE)}
            className="rounded-md border border-rule bg-card px-3 py-1.5 font-medium text-ink-2 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wider text-muted">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-rule bg-card px-2.5 py-1.5 text-xs text-ink outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
