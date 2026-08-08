import { useCallback, useEffect, useState } from 'react';
import { adminApi, ApiError } from '../../api/client';
import { formatXaf } from '../../lib/format';
import BuySellChart from '../../components/BuySellChart';

const RANGE_OPTIONS = [
  { value: 7, label: 'Last 7 days' },
  { value: 30, label: 'Last 30 days' },
  { value: 90, label: 'Last 90 days' },
];

function StatTile({ label, value, tone }) {
  return (
    <div className="rounded-lg border border-rule bg-card px-4 py-3.5">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 text-2xl font-semibold" style={tone ? { color: tone } : undefined}>
        {value}
      </div>
    </div>
  );
}

export default function AdminStatsPage() {
  const [days, setDays] = useState(30);
  const [measure, setMeasure] = useState('count');
  const [showTable, setShowTable] = useState(false);
  const [state, setState] = useState({ status: 'loading', data: null, error: null });

  const load = useCallback(async (rangeDays) => {
    try {
      const result = await adminApi.getStats(rangeDays);
      setState({ status: 'ready', data: result, error: null });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Could not load stats.';
      setState((s) => ({ status: 'error', data: s.data, error: message }));
    }
  }, []);

  useEffect(() => {
    load(days);
  }, [load, days]);

  const totals = state.data?.totals;

  return (
    <div>
      <div className="mb-6">
        <div className="text-[19px] font-semibold">Stats</div>
        <p className="mt-1.5 text-xs text-muted">Completed orders only — settled money, same as the queue's daily total.</p>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2.5 border-b border-rule pb-5">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider text-muted">Range</span>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="rounded-md border border-rule bg-card px-2.5 py-1.5 text-xs text-ink outline-none"
          >
            {RANGE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider text-muted">Measure</span>
          <select
            value={measure}
            onChange={(e) => setMeasure(e.target.value)}
            className="rounded-md border border-rule bg-card px-2.5 py-1.5 text-xs text-ink outline-none"
          >
            <option value="count">Order count</option>
            <option value="xaf">XAF volume</option>
          </select>
        </label>
        <button
          type="button"
          onClick={() => setShowTable((s) => !s)}
          className="mt-auto rounded-md border border-rule bg-card px-3 py-1.5 text-xs font-medium text-ink-2 hover:border-ink-2"
        >
          {showTable ? 'View as chart' : 'View as table'}
        </button>
      </div>

      {state.status === 'error' && <div className="mb-4 text-sm text-fault">{state.error}</div>}

      {totals && (
        <div className="mb-6 grid grid-cols-2 gap-2.5 md:grid-cols-4">
          <StatTile label="Buy orders" value={totals.buyCount} />
          <StatTile label="Buy volume" value={`${formatXaf(totals.buyXaf)} XAF`} />
          <StatTile label="Sell orders" value={totals.sellCount} />
          <StatTile label="Sell volume" value={`${formatXaf(totals.sellXaf)} XAF`} />
        </div>
      )}

      {state.status === 'loading' && <div className="text-sm text-muted">Loading…</div>}

      {state.data && !showTable && <BuySellChart days={state.data.days} measure={measure} />}

      {state.data && showTable && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-b border-rule text-[10px] uppercase tracking-wider text-muted">
                <th className="py-2 pr-3 font-medium">Date</th>
                <th className="py-2 pr-3 font-medium">Buy orders</th>
                <th className="py-2 pr-3 font-medium">Buy XAF</th>
                <th className="py-2 pr-3 font-medium">Sell orders</th>
                <th className="py-2 font-medium">Sell XAF</th>
              </tr>
            </thead>
            <tbody>
              {state.data.days.map((d) => (
                <tr key={d.date} className="border-b border-rule-soft">
                  <td className="tab py-2 pr-3 text-ink-2">{d.date}</td>
                  <td className="tab py-2 pr-3 text-ink-2">{d.buyCount}</td>
                  <td className="tab py-2 pr-3 text-ink-2">{formatXaf(d.buyXaf)}</td>
                  <td className="tab py-2 pr-3 text-ink-2">{d.sellCount}</td>
                  <td className="tab py-2 text-ink-2">{formatXaf(d.sellXaf)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
