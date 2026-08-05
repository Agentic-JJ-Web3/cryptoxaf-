import { Link } from 'react-router-dom';
import Masthead from '../components/Masthead';
import BackButton from '../components/BackButton';
import LedgerRow, { Perforation } from '../components/LedgerRow';
import { useMarketTicker } from '../lib/useMarketTicker';
import { formatXaf } from '../lib/format';

const EXAMPLE_XAF = 32_500;

const TROUBLE_ITEMS = [
  {
    title: 'You send the wrong XAF amount',
    body: "We match payments by MoMo reference, not amount alone. Message support with your order reference and we adjust the payout or refund the difference.",
  },
  {
    title: 'Your wallet address was wrong for the chain',
    body: "We can't send to an address that doesn't match its chain. Your payment is refunded to the MoMo number it came from, usually within 30 minutes.",
  },
  {
    title: 'You pay after the rate expires',
    body: 'We settle at the rate active when your payment arrives, not the one you saw on screen. Message support before paying if you want a fresh quote instead.',
  },
];

export default function HowItWorksPage() {
  const ticker = useMarketTicker();

  const marketRateXaf =
    ticker.status === 'ok' ? Math.round(Number(ticker.marketRateMicros) / 1_000_000) : null;
  const ourRateXaf = marketRateXaf != null ? Math.round(marketRateXaf * 1.029) : null;
  const marginXaf = ourRateXaf != null && marketRateXaf != null ? ourRateXaf - marketRateXaf : null;
  const bepFee = ticker.status === 'ok' ? ticker.bscNetworkFeeXaf : null;
  const exampleOut =
    ourRateXaf && bepFee != null ? (Math.max(EXAMPLE_XAF - bepFee, 0) / ourRateXaf).toFixed(2) : null;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col px-5 pb-10 text-ink">
      <Masthead />

      <div className="pt-4">
        <BackButton />
      </div>

      <div className="pb-1.5 pt-5">
        <h1 className="text-xl font-semibold tracking-tight text-ink">How it works</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-2">
          Every number below is the actual number. Nothing here is a promotional rate.
        </p>
      </div>

      {/* PRICING */}
      <div className="border-t border-rule-soft py-4.5">
        <div className="mb-3 font-mono text-[11px] uppercase tracking-wider text-muted">Pricing</div>
        <p className="mb-4 text-[13px] leading-relaxed text-ink-2">
          We quote above the market rate. The gap between the two is our entire fee — there is no other
          charge hidden in the number.
        </p>

        <div className="rounded-[10px] border border-rule bg-card px-4.5 py-5">
          <LedgerRow label="Market rate" value={marketRateXaf ? `${formatXaf(marketRateXaf)} XAF` : '—'} />
          <LedgerRow label="Our rate" value={ourRateXaf ? `${formatXaf(ourRateXaf)} XAF` : '—'} />
          <LedgerRow
            label="Our margin"
            value={marginXaf != null ? `${formatXaf(marginXaf)} XAF (+2.9%)` : '—'}
            tone="fee"
          />
        </div>

        <p className="mb-2 mt-3.5 text-xs text-muted">Worked example · sending {formatXaf(EXAMPLE_XAF)} XAF on BEP-20</p>
        <div className="rounded-[10px] border border-rule bg-card px-4.5 py-5">
          <LedgerRow label="Rate" value={ourRateXaf ? `${formatXaf(ourRateXaf)} XAF` : '—'} />
          <LedgerRow label="Network fee" value={bepFee != null ? `${formatXaf(bepFee)} XAF` : '—'} tone="fee" />
          <LedgerRow label="Amount paid" value={`${formatXaf(EXAMPLE_XAF)} XAF`} />
          <Perforation />
          <div className="flex items-baseline justify-between">
            <span className="text-[13px] font-medium text-ink">You receive</span>
            <span className="tab text-2xl font-semibold tracking-tight text-ink">
              {exampleOut ?? '—'} <span className="text-[13px] font-normal text-muted">USDT</span>
            </span>
          </div>
        </div>
      </div>

      {/* LIVE RATES BY NETWORK */}
      <div className="border-t border-rule-soft py-4.5">
        <div className="mb-3 font-mono text-[11px] uppercase tracking-wider text-muted">Live rates by network</div>
        <div className="flex flex-col gap-2.5">
          <div className="relative rounded-lg border border-rule px-4 py-3.5">
            <span className="absolute -top-1.5 right-3 rounded border border-fee bg-fee-bg px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-fee">
              Cheapest
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-semibold">BEP-20</span>
              <span className="tab font-mono text-[13px] text-ink-2">{ourRateXaf ? `${formatXaf(ourRateXaf)} XAF` : '—'}</span>
            </div>
            <div className="mt-1 font-mono text-[11px] text-fee">
              Network fee {bepFee != null ? `${formatXaf(bepFee)} XAF` : '—'}
            </div>
            <p className="mt-2 text-xs leading-relaxed text-ink-2">
              BNB Smart Chain. Our cheaper network fee. Confirm your wallet shows a BEP-20 or BSC balance —
              sending to an Ethereum-only address loses the funds permanently.
            </p>
          </div>
          <div className="rounded-lg border border-rule px-4 py-3.5">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-semibold">TRC-20</span>
              <span className="tab font-mono text-[13px] text-ink-2">{ourRateXaf ? `${formatXaf(ourRateXaf)} XAF` : '—'}</span>
            </div>
            <div className="mt-1 font-mono text-[11px] text-fee">
              Network fee {ticker.status === 'ok' ? `${formatXaf(ticker.tronNetworkFeeXaf)} XAF` : '—'}
            </div>
            <p className="mt-2 text-xs leading-relaxed text-ink-2">
              Tron. Widely supported by wallets and exchanges. Our fee is higher here because Tron network
              costs more for us to cover today.
            </p>
          </div>
        </div>
      </div>

      {/* SETTLEMENT */}
      <div className="border-t border-rule-soft py-4.5">
        <div className="mb-3 font-mono text-[11px] uppercase tracking-wider text-muted">Settlement</div>
        <p className="text-[13px] leading-relaxed text-ink-2">
          Orders settle in 5–15 minutes, Monday to Saturday, 7am to 9pm. Outside those hours your order
          waits in the queue and is settled first thing when we reopen — it is not lost or cancelled.
        </p>
      </div>

      {/* IF SOMETHING GOES WRONG */}
      <div className="border-t border-rule-soft py-4.5">
        <div className="mb-3 font-mono text-[11px] uppercase tracking-wider text-muted">If something goes wrong</div>
        <div className="flex flex-col gap-4">
          {TROUBLE_ITEMS.map((item) => (
            <div key={item.title}>
              <div className="text-[13px] font-semibold text-ink">{item.title}</div>
              <p className="mt-1 text-[13px] leading-relaxed text-ink-2">{item.body}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="pt-3.5">
        <Link to="/swap" className="text-[13px] font-semibold text-vault">
          Start a swap →
        </Link>
      </div>
    </div>
  );
}
