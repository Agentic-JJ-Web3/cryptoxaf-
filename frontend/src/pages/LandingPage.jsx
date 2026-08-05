import { useState } from 'react';
import { Link } from 'react-router-dom';
import ChainFeeCard from '../components/ChainFeeCard';
import LedgerRow, { Perforation } from '../components/LedgerRow';
import MobileNavSheet from '../components/MobileNavSheet';
import ActivityTicker from '../components/ActivityTicker';
import TestimonialCard from '../components/TestimonialCard';
import SpotlightCard from '../components/effects/SpotlightCard';
import GradientBlobs from '../components/effects/GradientBlobs';
import RevealOnScroll from '../components/effects/RevealOnScroll';
import Marquee from '../components/effects/Marquee';
import { useMarketTicker } from '../lib/useMarketTicker';
import { useReviews } from '../lib/useReviews';
import { formatXaf } from '../lib/format';

const EXAMPLE_XAF = 32_500;

const NAV_LINKS = [
  { to: '/how-it-works', label: 'How it works' },
  { to: '/orders', label: 'Order history' },
];

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

function Logo() {
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true" className="flex-none">
      <rect x="2" y="2" width="28" height="28" rx="7" fill="var(--vault)" />
      <circle cx="2" cy="16" r="4.5" fill="var(--paper)" />
      <circle cx="30" cy="16" r="4.5" fill="var(--paper)" />
      <rect x="14" y="6" width="4" height="20" rx="2" fill="var(--paper-2)" transform="rotate(45 16 16)" />
      <rect x="14" y="6" width="4" height="20" rx="2" fill="var(--paper-2)" transform="rotate(-45 16 16)" />
    </svg>
  );
}

function Header({ onOpenMenu }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-rule py-5">
      <Link to="/" className="flex items-center gap-2.5">
        <Logo />
        <div className="text-lg tracking-tight text-ink">
          Crypto<b className="font-semibold">XAF</b>
        </div>
      </Link>

      {/* Desktop: inline nav + CTA. Mobile: a single hamburger button. */}
      <nav className="hidden items-center gap-6 md:flex">
        {NAV_LINKS.map((link) => (
          <Link key={link.to} to={link.to} className="text-sm font-medium text-ink-2 hover:text-ink">
            {link.label}
          </Link>
        ))}
        <Link to="/swap" className="rounded-md bg-vault px-4 py-2.5 text-sm font-semibold text-paper-2">
          Start a swap
        </Link>
      </nav>

      <button
        type="button"
        onClick={onOpenMenu}
        aria-label="Open menu"
        className="flex h-9 w-9 flex-none items-center justify-center rounded-md border border-rule text-ink md:hidden"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

export default function LandingPage() {
  const ticker = useMarketTicker();
  const { reviews } = useReviews();
  const [menuOpen, setMenuOpen] = useState(false);

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
    <div className="relative mx-auto w-full max-w-[1100px] px-5 text-ink md:px-8">
      <GradientBlobs />
      <Header onOpenMenu={() => setMenuOpen(true)} />
      <MobileNavSheet open={menuOpen} onClose={() => setMenuOpen(false)} />

      {/* HERO + RECEIPT — stacked on mobile, side by side from md up */}
      <div className="md:flex md:items-center md:gap-14 md:pb-4 md:pt-10">
        <section className="pt-8 pb-2 md:max-w-[440px] md:flex-none md:pt-0 md:pb-0">
          <h1 className="text-[26px] leading-[1.15] font-semibold tracking-tight text-ink md:text-[38px]">
            XAF to USDT, over the MoMo you already use.
          </h1>
          <p className="mt-4 max-w-[52ch] text-[15px] leading-relaxed text-ink-2 md:text-base">
            No account, no signup. Send Mobile Money, get USDT on Tron or BNB Smart Chain. Every fee is on
            screen before you pay — nothing is added after.
          </p>
          <div className="mt-6 flex flex-col gap-2.5 sm:flex-row md:flex-col md:items-start lg:flex-row">
            <Link
              to="/swap"
              className="inline-flex w-full items-center justify-center rounded-md bg-vault py-3.5 text-[15px] font-semibold text-paper-2 sm:w-auto sm:px-8"
            >
              Start a swap
            </Link>
          </div>
          <div className="mt-2.5 text-center text-xs text-muted sm:text-left">
            Settles in 5–15 minutes · Mon–Sat, 7am–9pm
          </div>

          <div className="mt-7 hidden md:block">
            <ActivityTicker />
          </div>
        </section>

        {/* RECEIPT (signature element) */}
        <RevealOnScroll className="pt-8 pb-2 md:flex-1 md:pt-0 md:pb-0" delayMs={100}>
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

          <SpotlightCard className="rounded-[10px] border border-rule bg-card px-5 pb-4.5 pt-5.5">
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
          </SpotlightCard>
          <p className="mt-3 text-xs leading-relaxed text-muted">
            Market {marketRateXaf ?? '—'}. Ours {ourRateXaf ?? '—'}. The difference is our fee — never a
            promotional rate.
          </p>
        </RevealOnScroll>
      </div>

      {/* ACTIVITY (mobile position — desktop shows it next to the hero copy above) */}
      <div className="pb-2 md:hidden">
        <ActivityTicker />
      </div>

      {/* NETWORKS */}
      <RevealOnScroll className="border-t border-rule-soft pt-6 pb-2 md:pt-10">
        <div className="mb-3 font-mono text-[11px] uppercase tracking-wider text-muted">Networks</div>
        <div className="grid grid-cols-2 gap-2 md:max-w-[520px]">
          <SpotlightCard>
            <ChainFeeCard
              label="BEP-20"
              fee={ticker.status === 'ok' ? ticker.bscNetworkFeeXaf : null}
              cheapest={ticker.status === 'ok' && ticker.bscNetworkFeeXaf <= ticker.tronNetworkFeeXaf}
            />
          </SpotlightCard>
          <SpotlightCard>
            <ChainFeeCard
              label="TRC-20"
              fee={ticker.status === 'ok' ? ticker.tronNetworkFeeXaf : null}
              cheapest={ticker.status === 'ok' && ticker.tronNetworkFeeXaf < ticker.bscNetworkFeeXaf}
            />
          </SpotlightCard>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted">
          Chain is read from your wallet address automatically — never something to pick and get wrong.
        </p>
      </RevealOnScroll>

      {/* STATUS / TRUST */}
      <RevealOnScroll className="border-t border-rule-soft pt-6 pb-2 md:pt-10">
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
        <ul className="mt-4 space-y-2 md:max-w-[520px]">
          {TRUST_LINES.map((line) => (
            <li key={line} className="flex gap-2 text-[13px] leading-relaxed text-ink-2">
              <span className="mt-2 h-1 w-1 flex-none rounded-full bg-vault" />
              {line}
            </li>
          ))}
        </ul>
      </RevealOnScroll>

      {/* TESTIMONIALS — only once there's something real to show */}
      {reviews.length > 0 && (
        <RevealOnScroll className="border-t border-rule-soft pt-6 pb-2 md:pt-10" id="reviews">
          <div className="mb-3 font-mono text-[11px] uppercase tracking-wider text-muted">What people are saying</div>
          <div className="hidden gap-4 md:grid md:grid-cols-3">
            {reviews.slice(0, 6).map((review) => (
              <TestimonialCard key={review.id} review={review} />
            ))}
          </div>
          <div className="md:hidden">
            <Marquee durationSeconds={reviews.length * 6} itemClassName="w-[260px]">
              {reviews.map((review) => (
                <TestimonialCard key={review.id} review={review} />
              ))}
            </Marquee>
          </div>
        </RevealOnScroll>
      )}

      {/* FOOTER CTA */}
      <section className="mt-auto border-t border-rule-soft py-8">
        <Link
          to="/swap"
          className="inline-flex w-full items-center justify-center rounded-md bg-vault py-3.5 text-[15px] font-semibold text-paper-2 md:w-auto md:px-10"
        >
          Start a swap
        </Link>
        <div className="mt-4 text-center text-xs text-muted md:text-left">
          Settles in 5–15 minutes · Mon–Sat, 7am–9pm · No account needed
        </div>
        <div className="mt-4 flex items-center justify-center gap-4 text-xs font-medium text-ink-2 md:justify-start">
          <Link to="/how-it-works" className="underline">
            How it works
          </Link>
          <Link to="/orders" className="underline">
            Order history
          </Link>
        </div>
      </section>
    </div>
  );
}
