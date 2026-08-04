import { formatXaf } from '../lib/format';

export default function ChainFeeCard({ label, fee, cheapest, active, dimmed }) {
  return (
    <div
      className="relative rounded-md bg-paper-2 px-3 py-2.5 transition-opacity"
      style={{
        border: active ? '1px solid var(--vault)' : '1px solid var(--rule)',
        boxShadow: active ? 'inset 0 0 0 1px var(--vault)' : 'none',
        opacity: dimmed ? 0.4 : 1,
      }}
    >
      {cheapest && (
        <span className="absolute -top-1.5 right-2 whitespace-nowrap rounded border border-fee bg-fee-bg px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-fee">
          Cheapest
        </span>
      )}
      <span className="block text-[13px] font-semibold text-ink">{label}</span>
      <span className="mt-0.5 block font-mono text-[11px] text-fee">
        Network fee {fee != null ? `${formatXaf(fee)} XAF` : '—'}
      </span>
    </div>
  );
}
