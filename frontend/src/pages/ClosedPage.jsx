import { useState } from 'react';
import { Link } from 'react-router-dom';
import Masthead from '../components/Masthead';
import LedgerRow from '../components/LedgerRow';
import { useMarketTicker } from '../lib/useMarketTicker';
import { formatXaf } from '../lib/format';
import { api, ApiError } from '../api/client';

function buildWhatsappUrl() {
  const number = import.meta.env.VITE_SUPPORT_WHATSAPP;
  if (!number) return null;
  const text = encodeURIComponent('Hello, please notify me when CryptoXAF reopens');
  return `https://wa.me/${number}?text=${text}`;
}

export default function ClosedPage() {
  const ticker = useMarketTicker();
  const [phone, setPhone] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const marketRateXaf =
    ticker.status === 'ok' ? Math.round(Number(ticker.marketRateMicros) / 1_000_000) : null;
  const ourRateXaf = marketRateXaf != null ? Math.round(marketRateXaf * 1.029) : null;
  const whatsappUrl = buildWhatsappUrl();

  async function handleNotify() {
    if (!phone.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.notify(phone.trim());
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col px-5 pb-10 text-ink">
      <Masthead />

      {/* STATUS */}
      <div className="border-b border-rule-soft py-6.5">
        <div className="text-[21px] font-semibold tracking-tight text-ink">Closed for new orders</div>
        <p className="mt-2 text-sm leading-relaxed text-ink-2">
          We&rsquo;re not taking new orders right now. Reopens{' '}
          <b className="text-ink">{ticker.reopenLabel ?? 'soon'}</b>.
        </p>
        <p className="mt-3 text-xs leading-relaxed text-muted">
          Orders already placed are still tracked, and our operator is still settling them on schedule.
        </p>
        <Link to="/orders" className="mt-2.5 inline-block text-[13px] font-semibold text-vault">
          Check your order status →
        </Link>
      </div>

      {/* RATES STILL VISIBLE */}
      <div className="border-b border-rule-soft py-4.5">
        <div className="mb-3 font-mono text-[11px] uppercase tracking-wider text-muted">Current rates</div>
        <div className="rounded-[10px] border border-rule bg-card px-4.5 pb-3.5 pt-4.5">
          <LedgerRow label="Market rate" value={marketRateXaf ? `${formatXaf(marketRateXaf)} XAF` : '—'} />
          <LedgerRow label="Our rate" value={ourRateXaf ? `${formatXaf(ourRateXaf)} XAF` : '—'} />
          <LedgerRow
            label="BEP-20 network fee"
            value={ticker.status === 'ok' ? `${formatXaf(ticker.bscNetworkFeeXaf)} XAF` : '—'}
            tone="fee"
          />
          <LedgerRow
            label="TRC-20 network fee"
            value={ticker.status === 'ok' ? `${formatXaf(ticker.tronNetworkFeeXaf)} XAF` : '—'}
            tone="fee"
          />
        </div>
        <p className="mt-2.5 text-xs text-muted">
          Rates update while we&rsquo;re closed. They lock in only once we reopen and you place an order.
        </p>
      </div>

      {/* NOTIFY */}
      <div className="py-4.5">
        <div className="mb-3 font-mono text-[11px] uppercase tracking-wider text-muted">Get notified when we reopen</div>

        {submitted ? (
          <div className="rounded-lg border border-rule bg-card px-3.5 py-3 text-[13px] text-ink-2">
            We&rsquo;ll message {phone} when we reopen.
          </div>
        ) : (
          <div className="flex gap-2">
            <div className="flex-1 rounded-md border border-rule bg-card px-3.5 py-3">
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="6XX XXX XXX"
                className="w-full border-0 bg-transparent text-sm text-ink outline-none"
              />
            </div>
            <button
              type="button"
              onClick={handleNotify}
              disabled={!phone.trim() || submitting}
              className="flex-none rounded-md px-4.5 text-sm font-semibold disabled:cursor-not-allowed"
              style={{
                background: phone.trim() && !submitting ? 'var(--vault)' : 'var(--rule)',
                color: phone.trim() && !submitting ? 'var(--paper-2)' : 'var(--muted)',
              }}
            >
              Notify me
            </button>
          </div>
        )}
        {error && <div className="mt-2 text-xs leading-relaxed text-fault">{error}</div>}

        <div className="my-4 flex items-center gap-2.5">
          <div className="h-px flex-1 bg-rule-soft" />
          <span className="text-[11px] text-muted">or</span>
          <div className="h-px flex-1 bg-rule-soft" />
        </div>

        {whatsappUrl && (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-rule bg-card py-3.5 text-sm font-medium text-ink"
          >
            Message us on WhatsApp
          </a>
        )}

        <div className="mt-3 text-center text-xs text-muted">Open Mon–Sat, 7am–9pm</div>
      </div>
    </div>
  );
}
