import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Masthead from '../components/Masthead';
import CopyButton from '../components/CopyButton';
import LedgerRow, { Perforation } from '../components/LedgerRow';
import StarRating from '../components/StarRating';
import { api, ApiError } from '../api/client';
import { formatXaf, formatUsdtBaseUnits, headTail } from '../lib/format';
import { USDT_DECIMALS, CHAIN_LABELS } from '../lib/chains';
import { stageFromStatus } from '../lib/orderStage';
import { saveOrderToHistory } from '../lib/orderHistory';

const POLL_MS = 6000;

const TIMELINE_STEPS = [
  { key: 'waiting', label: 'Waiting for your payment' },
  { key: 'checking', label: 'Checking your payment' },
  { key: 'sent', label: 'USDT sent' },
  { key: 'refund', label: 'Refund on the way' },
];
const TIMELINE_ORDER = ['waiting', 'checking', 'sent', 'refund'];

function buildWhatsappUrl(reference) {
  const number = import.meta.env.VITE_SUPPORT_WHATSAPP;
  if (!number) return null;
  const text = encodeURIComponent(`Hello, I need help with order ${reference}`);
  return `https://wa.me/${number}?text=${text}`;
}

export default function OrderStatusPage() {
  const { reference } = useParams();
  const [state, setState] = useState({ status: 'loading', order: null, error: null });
  const [now, setNow] = useState(Date.now());
  const pollRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const result = await api.getOrder(reference);
        if (cancelled) return;
        setState({ status: 'ready', order: result.order, error: null });
        // Keeps device-local history in sync even for orders reached
        // directly (a bookmark, a shared link) rather than via /orders.
        saveOrderToHistory({
          reference: result.order.reference,
          xafAmount: result.order.xafAmount,
          chain: result.order.chain,
          status: result.order.status,
          createdAt: result.order.createdAt,
        });
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof ApiError ? err.message : 'Something went wrong loading this order.';
        setState({ status: 'error', order: null, error: message });
      }
    }

    load();
    pollRef.current = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(pollRef.current);
    };
  }, [reference]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (state.status === 'loading') {
    return (
      <Shell>
        <div className="pt-10 text-sm text-muted">Loading order…</div>
      </Shell>
    );
  }

  if (state.status === 'error') {
    return (
      <Shell>
        <div className="pt-10 text-sm text-fault">{state.error}</div>
        <Link to="/swap" className="mt-4 inline-block text-sm font-semibold text-vault">
          Start a new swap →
        </Link>
      </Shell>
    );
  }

  const { order } = state;
  const stage = stageFromStatus(order.status);
  const whatsappUrl = buildWhatsappUrl(order.reference);
  const { head: addrHead, tail: addrTail } = headTail(order.destinationAddress);
  const addrMid = order.destinationAddress.slice(6, -6);

  // Anchored to the order's last transition, so it restarts at each step
  // rather than tracking the exact moment payment was claimed (that
  // timestamp isn't in the customer-facing payload) — close enough for a
  // live "time in this step" readout without over-promising precision.
  const elapsedMs = Math.max(0, now - new Date(order.updatedAt).getTime());
  const elapsedMin = Math.floor(elapsedMs / 60000);
  const elapsedSec = Math.floor(elapsedMs / 1000) % 60;
  const pad = (n) => String(n).padStart(2, '0');
  const elapsedLabel =
    stage === 'sent'
      ? `Sent ${elapsedMin} min after payment`
      : stage === 'refund'
        ? `Refund initiated ${elapsedMin} min ago`
        : `${pad(elapsedMin)}:${pad(elapsedSec)} since payment`;

  return (
    <Shell>
      {/* ORDER REFERENCE */}
      <div className="border-b border-rule-soft py-4.5">
        <div className="mb-2 font-mono text-[11px] uppercase tracking-wider text-muted">Order reference</div>
        <div className="flex items-center justify-between gap-3">
          <div className="font-mono text-[28px] font-medium tracking-tight text-ink">{order.reference}</div>
          <CopyButton value={order.reference} />
        </div>
        {order.paymentReference && (
          <div className="mt-2.5 text-xs text-muted">
            Paid via MoMo · ref <span className="font-mono text-ink-2">{order.paymentReference}</span>
          </div>
        )}
      </div>

      {/* STATE PANEL */}
      {stage === 'waiting' && (
        <div className="border-b border-rule-soft py-5.5">
          <div className="text-[17px] font-semibold text-ink">Waiting for your payment</div>
          <p className="my-2 mb-3.5 text-[13px] leading-relaxed text-ink-2">
            We check for your MoMo payment automatically. Nothing to do here yet.
          </p>
          <Link to={`/pay/${order.reference}`} className="text-sm font-semibold text-vault">
            Go to payment instructions →
          </Link>
        </div>
      )}

      {stage === 'checking' && (
        <div className="border-b border-rule-soft py-5.5">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 flex-none animate-livepulse rounded-full bg-live" />
            <span className="text-[17px] font-semibold text-ink">Checking your payment</span>
          </div>
          <p className="my-2 mb-1 text-[13px] leading-relaxed text-ink-2">
            Your MoMo payment arrived. Confirming the amount now.
          </p>
          <div className="my-2.5 flex gap-1">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-[5px] w-[5px] animate-dotwave rounded-full bg-live"
                style={{ animationDelay: `${i * 0.2}s` }}
              />
            ))}
          </div>
          <div className="tab font-mono text-[13px] text-muted">{elapsedLabel}</div>
        </div>
      )}

      {stage === 'sent' && (
        <div className="my-5.5 rounded-xl bg-live px-5.5 py-6.5" style={{ color: '#0E1A16' }}>
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 12.5L9.5 18L20 6" stroke="#0E1A16" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div className="mt-3 text-[22px] font-semibold">USDT sent</div>
          <p className="mt-1.5 text-[13px] opacity-80">{elapsedLabel}</p>

          {order.explorerTxUrl && (
            <div className="mt-4.5 border-t pt-4" style={{ borderColor: 'rgba(14,26,22,.18)' }}>
              <div className="mb-2 font-mono text-[10px] uppercase tracking-wider opacity-70">Transaction hash</div>
              <a
                href={order.explorerTxUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-2.5 rounded-lg px-3.5 py-3 font-mono text-[13px]"
                style={{ background: 'rgba(255,255,255,.35)', color: '#0E1A16' }}
              >
                <span className="break-all">
                  {order.payoutTxHash.slice(0, 14)}…{order.payoutTxHash.slice(-10)}
                </span>
                <span className="flex-none text-xs font-semibold">
                  View on {order.chain === 'TRON' ? 'Tronscan' : 'BscScan'} →
                </span>
              </a>
            </div>
          )}
        </div>
      )}

      {stage === 'sent' && (
        <ReviewPrompt
          order={order}
          onReviewed={() => setState((s) => ({ ...s, order: { ...s.order, hasReview: true } }))}
        />
      )}

      {stage === 'refund' && (
        <div className="my-5.5 rounded-[10px] border border-fault bg-fault-bg px-4.5 py-5">
          <div className="text-[17px] font-semibold text-fault">Refund on the way</div>
          <p className="my-2 mb-3 text-[13px] leading-relaxed text-ink-2">
            {order.refundReason || 'This order could not be completed.'}
          </p>
          <div className="text-[13px] leading-relaxed text-ink-2">
            Your {formatXaf(order.xafAmount)} XAF is being returned to the MoMo number you paid from. Refunds
            arrive within 30 minutes.
          </div>
          {whatsappUrl && (
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="mt-3.5 inline-block text-sm font-semibold text-fault underline">
              Message support about this order
            </a>
          )}
        </div>
      )}

      {stage === 'expired' && (
        <div className="border-b border-rule-soft py-5.5">
          <div className="text-[17px] font-semibold text-ink">Quote expired</div>
          <p className="my-2 mb-3 text-[13px] leading-relaxed text-ink-2">
            This quote lapsed before payment. Nothing was lost — start a fresh swap when you're ready.
          </p>
          <Link to="/swap" className="text-sm font-semibold text-vault">
            Start a new swap →
          </Link>
        </div>
      )}

      {/* TIMELINE RECAP */}
      {stage !== 'expired' && (
        <div className="border-b border-rule-soft py-5">
          <div className="mb-3.5 font-mono text-[11px] uppercase tracking-wider text-muted">Order timeline</div>
          <div className="flex flex-col gap-2.5">
            {TIMELINE_STEPS.map((step) => {
              const stepIdx = TIMELINE_ORDER.indexOf(step.key);
              const currentIdx = TIMELINE_ORDER.indexOf(stage);
              const isCurrent = step.key === stage;
              // "Sent" and "refund" are alternative outcomes, not sequential
              // steps — a refunded order never marks "USDT sent" as past,
              // even though it sits earlier in TIMELINE_ORDER.
              const isPast = stepIdx < currentIdx && step.key !== 'sent';
              const dotColor = isCurrent
                ? stage === 'refund'
                  ? 'var(--fault)'
                  : stage === 'sent' || stage === 'checking'
                    ? 'var(--live)'
                    : 'var(--ink)'
                : 'var(--rule)';
              const textColor = isCurrent ? 'var(--ink)' : isPast ? 'var(--ink-2)' : 'var(--muted)';
              return (
                <div key={step.key} className="flex items-center gap-2.5">
                  <span className="h-[7px] w-[7px] flex-none rounded-full" style={{ background: dotColor }} />
                  <span className="text-[13px]" style={{ color: textColor, fontWeight: isCurrent ? 600 : 400 }}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* RECEIPT */}
      <div className="pb-1 pt-5.5">
        <div className="mb-3.5 font-mono text-[11px] uppercase tracking-wider text-muted">Receipt</div>
        <div className="rounded-[10px] border border-rule bg-card px-5 pb-4.5 pt-5.5">
          {order.rateSnapshot && (
            <>
              <LedgerRow label="Rate" value={`${formatXaf(Math.round(Number(order.rateSnapshot.quotedRateMicros) / 1e6))} XAF`} />
              <LedgerRow
                label={`Network fee (${CHAIN_LABELS[order.chain]})`}
                value={`${formatXaf(order.rateSnapshot.networkFeeXaf)} XAF`}
                tone="fee"
              />
            </>
          )}
          <LedgerRow label="Amount paid" value={`${formatXaf(order.xafAmount)} XAF`} />

          <Perforation />

          {stage === 'refund' ? (
            <div className="flex items-baseline justify-between">
              <span className="text-[13px] font-medium text-ink">Refund amount</span>
              <span className="tab text-[26px] font-semibold tracking-tight text-fault">
                {formatXaf(order.xafAmount)} <span className="text-sm font-normal text-muted">XAF</span>
              </span>
            </div>
          ) : (
            <div className="flex items-baseline justify-between">
              <span className="text-[13px] font-medium text-ink">Amount received</span>
              <span className="tab text-[26px] font-semibold tracking-tight text-ink">
                {formatUsdtBaseUnits(order.usdtAmount, USDT_DECIMALS[order.chain])}{' '}
                <span className="text-sm font-normal text-muted">USDT</span>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* DESTINATION */}
      <div className="border-t border-rule-soft py-5.5" style={{ opacity: stage === 'refund' ? 0.55 : 1 }}>
        <div className="mb-2.5 font-mono text-[11px] uppercase tracking-wider text-muted">
          Destination wallet · {CHAIN_LABELS[order.chain]}
        </div>
        <div className="break-all font-mono text-sm leading-relaxed" style={{ color: 'var(--rule)' }}>
          <span style={{ color: 'var(--ink)' }}>{addrHead}</span>
          <span>{addrMid}</span>
          <span style={{ color: 'var(--ink)' }}>{addrTail}</span>
        </div>
        {stage === 'refund' && <div className="mt-2 text-xs text-muted">Not used — this order did not settle.</div>}
      </div>

      {/* SUPPORT */}
      <div className="pt-2 pb-2">
        {whatsappUrl && (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-rule bg-card py-3.5 text-sm font-medium text-ink"
          >
            Message support on WhatsApp
          </a>
        )}
        <div className="mt-3 text-center text-xs text-muted">Settles in 5–15 minutes · Mon–Sat, 7am–9pm</div>
        <Link to="/orders" className="mt-3 block text-center text-xs font-semibold text-vault">
          View all orders on this device
        </Link>
      </div>
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col px-5 pb-7 text-ink">
      <Masthead />
      {children}
    </div>
  );
}

function ReviewPrompt({ order, onReviewed }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  if (order.hasReview) {
    return (
      <div className="border-b border-rule-soft py-5 text-[13px] text-muted">
        Thanks — your review is pending approval.
      </div>
    );
  }

  async function handleSubmit() {
    if (rating < 1) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.submitReview(order.reference, { rating, comment: comment.trim() || undefined });
      onReviewed();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not submit your review. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="border-b border-rule-soft py-5">
      <div className="text-[15px] font-semibold text-ink">Rate your swap</div>
      <p className="mt-1.5 text-[13px] text-muted">Your review is checked before it's shown to other customers.</p>

      <div className="mt-3.5">
        <StarRating value={rating} onChange={setRating} size="lg" />
      </div>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Optional — tell us how it went"
        rows={2}
        maxLength={500}
        className="mt-3 w-full resize-y rounded-md border border-rule bg-card px-3 py-2.5 text-[13px] text-ink outline-none focus:border-vault"
      />

      {error && <div className="mt-2 text-xs text-fault">{error}</div>}

      <button
        type="button"
        disabled={rating < 1 || submitting}
        onClick={handleSubmit}
        className="mt-3 rounded-md bg-vault px-5 py-2.5 text-sm font-semibold text-paper-2 disabled:bg-rule disabled:text-muted"
      >
        {submitting ? 'Submitting…' : 'Submit review'}
      </button>
    </div>
  );
}
