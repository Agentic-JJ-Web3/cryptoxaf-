import { Link } from 'react-router-dom';
import Masthead from '../components/Masthead';
import ChainFeeCard from '../components/ChainFeeCard';
import LedgerRow, { Perforation } from '../components/LedgerRow';
import { useMarketTicker } from '../lib/useMarketTicker';
import { formatXaf } from '../lib/format';

const EXAMPLE_XAF = 32_500;

const TRUST_LINES = [
  'Settles in 5–15 minutes. We’ll text you when it’s sent.',
  'Every fee is shown before you pay. Nothing is added after.',
];

const STATUS_PILLS = [
  { label: 'Waiting for your payment', tone: 'wait' },
  { label: 'Checking your payment', tone: 'check' },
  { label: 'USDT sent', tone: 'done' },
  { label: 'Refund on the way', tone: 'fail' },
];

const PILL_STYLES = {
  wait: 'border-rule bg-paper-2 text-muted',
  check: 'border-fee bg-fee-bg text-fee',
  done: 'border-vault text-vault',
  fail: 'border-fault bg-fault-bg text-fault',
};

export default function LandingPage() {
  const ticker = useMarketTicker();

  const marketRateXaf =
    ticker.status === 'ok' ? Math.round(Number(ticker.marketRateMicros) / 1_000_000) : null;
  const bestFee =
    ticker.status === 'ok' ? Math.min(ticker.tronNetworkFeeXaf, ticker.bscNetworkFeeXaf) : null;
  const exampleNet = bestFee != null ? Math.max(EXAMPLE_XAF - bestFee, 0) : null;
  // Display-only estimate for the hero receipt — the real, exact quote is
  // computed server-side once a wallet address (and therefore a chain) is
  // known; this never backs an actual order.
  const ourRateXaf = marketRateXaf != null ? Math.round(marketRateXaf * 1.029) : null;
  const exampleOut = exampleNet != null && ourRateXaf ? (exampleNet / ourRateXaf).toFixed(2) : null;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col px-5 text-ink">
      <Masthead />

      {/* HERO */}
      <section className="pt-8 pb-2">
        <h1 className="text-[26px] leading-[1.15] font-semibold tracking-tight text-ink">
          XAF to USDT, over the MoMo you already use.
        </h1>
        <p className="mt-4 max-w-[52ch] text-[15px] leading-relaxed text-ink-2">
          No account, no signup. Send Mobile Money, get USDT on Tron or BNB Smart Chain. Every fee is on
          screen before you pay — nothing is added after.
        </p>
        <Link
          to="/swap"
          className="mt-6 inline-flex w-full items-center justify-center rounded-md bg-vault py-3.5 text-[15px] font-semibold text-paper-2"
        >
          Start a swap
        </Link>
        <div className="mt-2.5 text-center text-xs text-muted">Settles in 5–15 minutes · Mon–Sat, 7am–9pm</div>
      </section>

      {/* RECEIPT (signature element) */}
      <section className="pt-8 pb-2">
        <div className="mb-3 flex items-center gap-1.5 font-mono text-[11px] text-muted">
          {ticker.status === 'ok' ? (
            <>
              <span className="h-1.5 w-1.5 flex-none animate-livepulse rounded-full bg-live" />
              <span className="tab">
                Market {marketRateXaf} XAF · updated {ticker.secondsAgo}s ago
              </span>
            </>
          ) : (
            <>
              <span className="h-1.5 w-1.5 flex-none rounded-full bg-muted" />
              <span>Rate unavailable</span>
            </>
          )}
        </div>

        <div className="rounded-[10px] border border-rule bg-card px-5 pb-4.5 pt-5.5">
          <div className="mb-4 flex items-baseline justify-between">
            <span className="text-[13px] font-semibold text-ink">Example swap</span>
            <span className="font-mono text-xs text-muted">BEP-20</span>
          </div>

          <LedgerRow label="Rate" value={ourRateXaf ? `${formatXaf(ourRateXaf)} XAF · market +2.9%` : '—'} />
          <LedgerRow label="Network fee" value={bestFee != null ? `${formatXaf(bestFee)} XAF` : '—'} tone="fee" />
          <LedgerRow label="You pay" value={`${formatXaf(EXAMPLE_XAF)} XAF`} />

          <Perforation />

          <div className="flex items-baseline justify-between">
            <span className="text-[13px] font-medium text-ink">You receive</span>
            <span className="tab text-[26px] font-semibold tracking-tight text-ink">
              {exampleOut ?? '—'} <span className="text-sm font-normal text-muted">USDT</span>
            </span>
          </div>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted">
          Market {marketRateXaf ?? '—'}. Ours {ourRateXaf ?? '—'}. The difference is our fee — never a
          promotional rate.
        </p>
      </section>

      {/* NETWORKS */}
      <section className="border-t border-rule-soft pt-6 pb-2">
        <div className="mb-3 font-mono text-[11px] uppercase tracking-wider text-muted">Networks</div>
        <div className="grid grid-cols-2 gap-2">
          <ChainFeeCard
            label="BEP-20"
            fee={ticker.status === 'ok' ? ticker.bscNetworkFeeXaf : null}
            cheapest={ticker.status === 'ok' && ticker.bscNetworkFeeXaf <= ticker.tronNetworkFeeXaf}
          />
          <ChainFeeCard
            label="TRC-20"
            fee={ticker.status === 'ok' ? ticker.tronNetworkFeeXaf : null}
            cheapest={ticker.status === 'ok' && ticker.tronNetworkFeeXaf < ticker.bscNetworkFeeXaf}
          />
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted">
          Chain is read from your wallet address automatically — never something to pick and get wrong.
        </p>
      </section>

      {/* STATUS / TRUST */}
      <section className="border-t border-rule-soft pt-6 pb-2">
        <div className="mb-3 font-mono text-[11px] uppercase tracking-wider text-muted">Always know where your order is</div>
        <div className="flex flex-wrap gap-2">
          {STATUS_PILLS.map((pill) => (
            <span
              key={pill.label}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium ${PILL_STYLES[pill.tone]}`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {pill.label}
            </span>
          ))}
        </div>
        <ul className="mt-4 space-y-2">
          {TRUST_LINES.map((line) => (
            <li key={line} className="flex gap-2 text-[13px] leading-relaxed text-ink-2">
              <span className="mt-2 h-1 w-1 flex-none rounded-full bg-vault" />
              {line}
            </li>
          ))}
        </ul>
      </section>

      {/* FOOTER CTA */}
      <section className="mt-auto border-t border-rule-soft py-8">
        <Link
          to="/swap"
          className="inline-flex w-full items-center justify-center rounded-md bg-vault py-3.5 text-[15px] font-semibold text-paper-2"
        >
          Start a swap
        </Link>
        <div className="mt-4 text-center text-xs text-muted">
          Settles in 5–15 minutes · Mon–Sat, 7am–9pm · No account needed
        </div>
      </section>
    </div>
  );
}
