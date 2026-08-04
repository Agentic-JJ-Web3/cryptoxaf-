import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import Masthead from '../components/Masthead';
import CopyButton from '../components/CopyButton';
import { api, ApiError } from '../api/client';
import { formatXaf, formatCountdown } from '../lib/format';

export default function PaymentPage() {
  const { reference } = useParams();
  const navigate = useNavigate();

  const [state, setState] = useState({ status: 'loading', order: null, payment: null, error: null });
  const [txId, setTxId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const result = await api.getOrder(reference);
        if (cancelled) return;
        setState({ status: 'ready', order: result.order, payment: result.payment, error: null });
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof ApiError ? err.message : 'Something went wrong loading this order.';
        setState({ status: 'error', order: null, payment: null, error: message });
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [reference]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Payment already claimed (e.g. reopened from another tab) or resolved
  // further — this screen's job is done, the status page takes over.
  useEffect(() => {
    if (state.order && state.order.status !== 'AWAITING_PAYMENT') {
      navigate(`/order/${reference}`, { replace: true });
    }
  }, [state.order, reference, navigate]);

  async function handleSubmit() {
    if (!txId.trim() || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await api.claimPayment(reference, { momoTxId: txId.trim() });
      navigate(`/order/${reference}`);
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

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

  const { order, payment } = state;
  const remainingMs = new Date(order.quoteExpiresAt).getTime() - now;
  const expired = remainingMs <= 0;

  return (
    <Shell>
      {/* ORDER REFERENCE */}
      <div className="border-b border-rule-soft py-4.5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="mb-1.5 font-mono text-[11px] uppercase tracking-wider text-muted">Order reference</div>
            <div className="font-mono text-[19px] font-medium text-ink">{order.reference}</div>
          </div>
          <CopyButton value={order.reference} />
        </div>
        <p className="mt-2.5 text-xs leading-relaxed text-muted">
          This reference is how we find your order. There is no account to log into — keep it until settlement is
          done.
        </p>
      </div>

      {/* RATE HOLD */}
      {expired ? (
        <div className="border-b border-rule-soft py-4">
          <div className="text-sm text-ink">Rate hold expired.</div>
          <p className="my-1 mb-3 text-xs leading-relaxed text-muted">
            This is recoverable. Get a fresh quote to continue — nothing has been lost.
          </p>
          <Link
            to="/swap"
            className="block w-full rounded-md border border-vault py-3 text-center text-sm font-semibold text-vault"
          >
            Get a fresh quote
          </Link>
        </div>
      ) : (
        <div className="flex items-baseline justify-between border-b border-rule-soft py-3.5 font-mono text-xs text-muted">
          <span>Rate held for</span>
          <span className="tab text-ink-2">{formatCountdown(remainingMs)}</span>
        </div>
      )}

      <div style={expired ? { opacity: 0.55 } : undefined}>
        {/* AMOUNT */}
        <div className="pb-2 pt-5.5">
          <div className="mb-2 font-mono text-[11px] uppercase tracking-wider text-muted">Send exactly</div>
          <div className="flex items-center justify-between gap-3">
            <div className="tab text-[38px] font-semibold tracking-tight text-ink">
              {formatXaf(order.xafAmount)} <span className="text-[17px] font-normal text-muted">XAF</span>
            </div>
            <CopyButton value={String(order.xafAmount)} />
          </div>
          <p className="mt-2.5 text-xs leading-relaxed text-ink-2">
            Send this amount exactly. A different amount cannot be matched automatically and will delay settlement.
          </p>
        </div>

        {/* MOMO NUMBER */}
        <div className="border-t border-rule-soft py-4.5">
          <div className="mb-2 flex items-center gap-2">
            <div className="font-mono text-[11px] uppercase tracking-wider text-muted">Pay to</div>
            {payment && (
              <span className="whitespace-nowrap rounded border border-rule px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-ink-2">
                {payment.momoNetwork === 'ORANGE' ? 'Orange Money' : 'MTN MoMo'}
              </span>
            )}
          </div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-mono text-xl font-medium text-ink">{payment?.momoNumber}</div>
              <div className="mt-1 text-xs text-muted">{payment?.momoAccountName}</div>
            </div>
            <CopyButton value={payment?.momoNumber ?? ''} />
          </div>
        </div>

        {/* STEPS */}
        <div className="border-t border-rule-soft py-5">
          <div className="mb-3.5 font-mono text-[11px] uppercase tracking-wider text-muted">How to pay</div>
          <ol className="flex flex-col gap-3.5">
            {[
              'Open your MoMo app',
              'Send the exact amount above',
              'Copy the transaction ID from the confirmation SMS',
              'Paste it below and confirm',
            ].map((step, i) => (
              <li key={step} className="flex gap-3">
                <span className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full border border-rule bg-paper-2 text-xs font-semibold text-ink-2">
                  {i + 1}
                </span>
                <span className="pt-0.5 text-sm text-ink-2">{step}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* TX ID */}
        <div className="pb-5 pt-1.5">
          <label className="mb-1.5 block text-xs text-muted" htmlFor="tx-id">
            MoMo transaction ID
          </label>
          <div className="rounded-md border border-rule bg-card px-3.5 py-3">
            <input
              id="tx-id"
              type="text"
              value={txId}
              onChange={(e) => setTxId(e.target.value)}
              placeholder="e.g. MP240731.4471.882610"
              spellCheck={false}
              autoCapitalize="off"
              disabled={expired}
              className="mono w-full border-0 bg-transparent text-sm text-ink outline-none disabled:opacity-50"
            />
          </div>
          {submitError && <div className="mt-2 text-xs leading-relaxed text-fault">{submitError}</div>}
        </div>
      </div>

      <div className="flex-1" />

      {/* CTA */}
      <div className="sticky bottom-0 mt-3 border-t border-rule bg-paper pb-1.5 pt-3.5">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={expired || !txId.trim() || submitting}
          className="w-full rounded-md py-3.5 text-[15px] font-semibold tracking-wide disabled:cursor-not-allowed"
          style={{
            background: !expired && txId.trim() && !submitting ? 'var(--vault)' : 'var(--rule)',
            color: !expired && txId.trim() && !submitting ? 'var(--paper-2)' : 'var(--muted)',
          }}
        >
          {submitting ? 'Confirming…' : "I've sent the payment"}
        </button>
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
