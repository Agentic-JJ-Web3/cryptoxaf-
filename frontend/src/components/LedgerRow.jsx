export default function LedgerRow({ label, value, tone = 'default' }) {
  const valueColor = tone === 'fee' ? 'text-fee' : 'text-ink-2';
  return (
    <div className="flex items-baseline py-[5px] text-[13px]">
      <span className="whitespace-nowrap text-muted">{label}</span>
      <span
        className="mx-2 min-w-[14px] flex-1 border-b border-dotted border-rule"
        style={{ transform: 'translateY(-4px)' }}
      />
      <span className={`tab whitespace-nowrap ${valueColor}`}>{value}</span>
    </div>
  );
}

export function Perforation() {
  return (
    <div className="relative my-3.5 -mx-5 h-[18px] sm:-mx-6">
      <div
        className="absolute top-[9px] left-5 right-5 h-px sm:left-6 sm:right-6"
        style={{
          background:
            'repeating-linear-gradient(to right, var(--rule) 0 5px, transparent 5px 11px)',
        }}
      />
      <div className="absolute -left-2 top-0.5 h-[15px] w-[15px] rounded-full border border-rule bg-paper" />
      <div className="absolute -right-2 top-0.5 h-[15px] w-[15px] rounded-full border border-rule bg-paper" />
    </div>
  );
}
