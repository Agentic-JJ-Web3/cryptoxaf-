import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import Masthead from '../components/Masthead';
import BackButton from '../components/BackButton';
import CopyButton from '../components/CopyButton';
import { api, ApiError } from '../api/client';
import { formatUsdtBaseUnits, formatCountdown, headTail } from '../lib/format';
import { USDT_DECIMALS, CHAIN_LABELS } from '../lib/chains';

export default function DepositPage() {
  const { reference } = useParams();
  const navigate = useNavigate();

  const [state, setState] = useState({ status: 'loading', order: null, deposit: null, error: null });
  const [proofMode, setProofMode] = useState('hash');
  const [txHash, setTxHash] = useState('');
  const [receiptFile, setReceiptFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const result = await api.getOrder(reference);
        if (cancelled) return;
        setState({ status: 'ready', order: result.order, deposit: result.deposit, error: null });
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof ApiError ? err.message : 'Something went wrong loading this order.';
        setState({ status: 'error', order: null, deposit: null, error: message });
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

  useEffect(() => {
    if (state.order && state.order.status !== 'AWAITING_DEPOSIT') {
      navigate(`/order/${reference}`, { replace: true });
    }
  }, [state.order, reference, navigate]);

  const hasProof = proofMode === 'hash' ? txHash.trim().length > 0 : !!receiptFile;

  async function handleSubmit() {
    if (!hasProof || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await api.claimDeposit(reference, {
        txHash: proofMode === 'hash' ? txHash.trim() : undefined,
        receipt: proofMode === 'screenshot' ? receiptFile : undefined,
      });
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

  const { order, deposit } = state;
  const remainingMs = new Date(order.quoteExpiresAt).getTime() - now;
  const expired = remainingMs <= 0;
  const depositTail = deposit ? headTail(deposit.depositAddress) : null;

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
              {formatUsdtBaseUnits(order.usdtAmount, USDT_DECIMALS[order.chain])}{' '}
              <span className="text-[17px] font-normal text-muted">USDT</span>
            </div>
            <CopyButton value={formatUsdtBaseUnits(order.usdtAmount, USDT_DECIMALS[order.chain])} />
          </div>
          <p className="mt-2.5 text-xs leading-relaxed text-ink-2">
            Send this amount exactly, on {CHAIN_LABELS[order.chain]}. A different amount or network cannot be
            matched automatically and will delay settlement.
          </p>
        </div>

        {/* DEPOSIT ADDRESS */}
        <div className="border-t border-rule-soft py-4.5">
          <div className="mb-2 flex items-center gap-2">
            <div className="font-mono text-[11px] uppercase tracking-wider text-muted">Deposit address</div>
            <span className="whitespace-nowrap rounded border border-rule px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-ink-2">
              {CHAIN_LABELS[order.chain]}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="mono break-all text-sm text-ink">{deposit?.depositAddress}</div>
            <CopyButton value={deposit?.depositAddress ?? ''} />
          </div>
          {depositTail && (
            <div className="mt-2 font-mono text-xs text-ink-2">
              Confirm in your wallet: <b className="rounded bg-fee-bg px-1 font-medium text-fee">{depositTail.head}</b>{' '}
              … <b className="rounded bg-fee-bg px-1 font-medium text-fee">{depositTail.tail}</b>
            </div>
          )}
        </div>

        {/* PROOF */}
        <div className="border-t border-rule-soft py-5">
          <div className="mb-3.5 font-mono text-[11px] uppercase tracking-wider text-muted">
            After you've sent it
          </div>

          <div className="mb-3 flex gap-2">
            <button
              type="button"
              onClick={() => setProofMode('hash')}
              className="flex-1 rounded-md border py-2 text-xs font-medium"
              style={{
                borderColor: proofMode === 'hash' ? 'var(--vault)' : 'var(--rule)',
                color: proofMode === 'hash' ? 'var(--vault)' : 'var(--muted)',
              }}
            >
              I have the transaction hash
            </button>
            <button
              type="button"
              onClick={() => setProofMode('screenshot')}
              className="flex-1 rounded-md border py-2 text-xs font-medium"
              style={{
                borderColor: proofMode === 'screenshot' ? 'var(--vault)' : 'var(--rule)',
                color: proofMode === 'screenshot' ? 'var(--vault)' : 'var(--muted)',
              }}
            >
              Upload a screenshot instead
            </button>
          </div>

          {proofMode === 'hash' ? (
            <div key="hash" className="rounded-md border border-rule bg-card px-3.5 py-3">
              <input
                type="text"
                value={txHash}
                onChange={(e) => setTxHash(e.target.value)}
                placeholder="Transaction hash"
                spellCheck={false}
                autoCapitalize="off"
                disabled={expired}
                aria-label="Transaction hash"
                className="mono w-full border-0 bg-transparent text-sm text-ink outline-none disabled:opacity-50"
              />
            </div>
          ) : (
            <div key="screenshot" className="rounded-md border border-dashed border-rule bg-card px-3.5 py-4 text-center">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
                disabled={expired}
                aria-label="Transfer screenshot"
                className="w-full text-xs text-ink-2 disabled:opacity-50"
              />
              {receiptFile && <p className="mt-2 text-xs text-muted">{receiptFile.name}</p>}
            </div>
          )}

          {submitError && <div className="mt-2 text-xs leading-relaxed text-fault">{submitError}</div>}
        </div>
      </div>

      <div className="flex-1" />

      {/* CTA */}
      <div className="sticky bottom-0 mt-3 border-t border-rule bg-paper pb-1.5 pt-3.5">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={expired || !hasProof || submitting}
          className="w-full rounded-md py-3.5 text-[15px] font-semibold tracking-wide disabled:cursor-not-allowed"
          style={{
            background: !expired && hasProof && !submitting ? 'var(--vault)' : 'var(--rule)',
            color: !expired && hasProof && !submitting ? 'var(--paper-2)' : 'var(--muted)',
          }}
        >
          {submitting ? 'Confirming…' : "I've sent the USDT"}
        </button>
      </div>
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col px-5 pb-7 text-ink">
      <Masthead />
      <div className="pt-4">
        <BackButton fallback="/swap" />
      </div>
      {children}
    </div>
  );
}
