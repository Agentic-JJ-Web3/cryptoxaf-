import { useState } from 'react';
import { useNavigate, useSearchParams, Navigate } from 'react-router-dom';
import Masthead from '../components/Masthead';
import ChainFeeCard from '../components/ChainFeeCard';
import LedgerRow, { Perforation } from '../components/LedgerRow';
import { useMarketTicker } from '../lib/useMarketTicker';
import { useQuotePreview } from '../lib/useQuotePreview';
import { useSellQuotePreview } from '../lib/useSellQuotePreview';
import { formatXaf, formatUsdtBaseUnits } from '../lib/format';
import { USDT_DECIMALS, CHAIN_LABELS } from '../lib/chains';
import { saveOrderToHistory, saveAddressToHistory } from '../lib/orderHistory';
import { api, ApiError } from '../api/client';

export default function SwapPage() {
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState('buy');
  const ticker = useMarketTicker();

  if (ticker.status === 'ok' && ticker.isOpen === false) {
    return <Navigate to="/closed" replace />;
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col text-ink">
      <div className="flex-1 px-5 pb-6">
        <Masthead />

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setMode('buy')}
            className="rounded-md py-2.5 text-center text-sm font-semibold"
            style={{
              background: mode === 'buy' ? 'var(--vault)' : 'transparent',
              color: mode === 'buy' ? 'var(--paper-2)' : 'var(--muted)',
              border: mode === 'buy' ? 'none' : '1px solid var(--rule)',
            }}
          >
            Buy USDT
          </button>
          <button
            type="button"
            onClick={() => setMode('sell')}
            className="rounded-md py-2.5 text-center text-sm font-semibold"
            style={{
              background: mode === 'sell' ? 'var(--vault)' : 'transparent',
              color: mode === 'sell' ? 'var(--paper-2)' : 'var(--muted)',
              border: mode === 'sell' ? 'none' : '1px solid var(--rule)',
            }}
          >
            Sell USDT
          </button>
        </div>

        {/* Ticker */}
        <div className="mt-5 flex items-center gap-1.5 font-mono text-[11px] text-muted">
          {ticker.status === 'ok' ? (
            <>
              <span className="h-1.5 w-1.5 flex-none animate-livepulse rounded-full bg-live" />
              <span className="tab">
                Market {Math.round(Number(ticker.marketRateMicros) / 1_000_000)} XAF · updated {ticker.secondsAgo}s ago
              </span>
            </>
          ) : (
            <>
              <span className="h-1.5 w-1.5 flex-none rounded-full bg-muted" />
              <span>Rate unavailable</span>
            </>
          )}
        </div>

        {mode === 'buy' ? (
          <BuyForm ticker={ticker} initialAddress={searchParams.get('address') || ''} />
        ) : (
          <SellForm ticker={ticker} />
        )}
      </div>
    </div>
  );
}

function BuyForm({ ticker, initialAddress }) {
  const navigate = useNavigate();
  const [xafAmount, setXafAmount] = useState(0);
  const [destinationAddress, setDestinationAddress] = useState(initialAddress);
  const [bscConfirmed, setBscConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const preview = useQuotePreview({ xafAmount, destinationAddress });
  const data = preview.data;

  const addressTouched = destinationAddress.trim().length > 0;
  const chain = data?.chain ?? null;
  const requiresBscConfirmation = data?.requiresBscConfirmation ?? false;
  const canSubmit = Boolean(
    ticker.status === 'ok' &&
      data?.addressValid &&
      data?.usdtAmount &&
      !data?.amountError &&
      (!requiresBscConfirmation || bscConfirmed),
  );

  let ctaLabel = 'Enter a valid wallet address';
  if (ticker.status !== 'ok') ctaLabel = 'Rate unavailable';
  else if (data?.addressValid && data?.amountError) ctaLabel = data.amountError;
  else if (data?.addressValid && requiresBscConfirmation && !bscConfirmed) ctaLabel = 'Confirm the network above';
  else if (canSubmit) ctaLabel = 'Continue to payment';

  function handleAmountInput(e) {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    setXafAmount(raw ? parseInt(raw, 10) : 0);
  }

  function handleAddressInput(e) {
    setDestinationAddress(e.target.value);
    setBscConfirmed(false);
  }

  async function handleSubmit() {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await api.createOrder({ xafAmount, destinationAddress, bscConfirmed });
      saveOrderToHistory({
        reference: result.order.reference,
        xafAmount: result.order.xafAmount,
        chain: result.order.chain,
        status: result.order.status,
        createdAt: result.order.createdAt,
      });
      saveAddressToHistory({ chain: result.order.chain, address: result.order.destinationAddress });
      navigate(`/pay/${result.order.reference}`);
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const quotedRateXaf = data?.rate ? Math.round(Number(data.rate.quotedRateMicros) / 1_000_000) : null;
  const marginPct = data?.rate ? (data.rate.targetMarginBps / 100).toFixed(1) : null;

  return (
    <>
      {/* Amount */}
      <div className="mt-4.5">
        <label className="mb-1.5 block text-xs text-muted" htmlFor="amount">
          You pay
        </label>
        <div className="flex items-center gap-2 rounded-md border border-rule bg-card px-3.5 py-3">
          <input
            id="amount"
            type="text"
            inputMode="numeric"
            value={xafAmount ? formatXaf(xafAmount) : ''}
            onChange={handleAmountInput}
            placeholder="0"
            aria-label="Amount in XAF"
            className="tab w-full border-0 bg-transparent text-[22px] font-semibold tracking-tight text-ink outline-none"
          />
          <span className="whitespace-nowrap text-[13px] font-medium text-muted">XAF</span>
        </div>
      </div>

      {/* Wallet address */}
      <div className="mt-4">
        <label className="mb-1.5 block text-xs text-muted" htmlFor="address">
          Send to wallet
        </label>
        <div className="rounded-md border border-rule bg-card px-3.5 py-3">
          <input
            id="address"
            type="text"
            value={destinationAddress}
            onChange={handleAddressInput}
            spellCheck={false}
            autoCapitalize="off"
            aria-label="Wallet address"
            className="mono w-full border-0 bg-transparent text-[13px] text-ink outline-none"
          />
        </div>

        {addressTouched && data && !data.addressValid && (
          <div className="mt-2 text-xs leading-relaxed text-fault">
            <span className="mr-1.5 rounded border border-fault bg-fault-bg px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider">
              Check this
            </span>
            {data.addressError}
          </div>
        )}

        {data?.addressValid && (
          <div className="mt-2 text-xs leading-relaxed text-muted">
            <span
              className="mr-1.5 rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-vault"
              style={{ borderColor: 'var(--vault)', background: 'rgba(63,208,143,.1)' }}
            >
              {chain === 'TRON' ? 'Tron · TRC-20' : 'BNB Smart Chain · BEP-20'}
            </span>
            Chain set from your address.
            <span className="mt-1.5 block font-mono text-xs text-ink-2">
              Confirm in your wallet:{' '}
              <b className="rounded bg-fee-bg px-1 font-medium text-fee">{data.addressHead}</b> …{' '}
              <b className="rounded bg-fee-bg px-1 font-medium text-fee">{data.addressTail}</b>
            </span>
          </div>
        )}

        {requiresBscConfirmation && (
          <label className="mt-3 flex items-start gap-2 rounded-md border border-fee bg-fee-bg px-3 py-2.5 text-xs leading-relaxed text-fee">
            <input
              type="checkbox"
              checked={bscConfirmed}
              onChange={(e) => setBscConfirmed(e.target.checked)}
              className="mt-0.5 flex-none accent-fee"
            />
            <span>
              A <b>0x</b> address exists on every EVM chain. Confirm your wallet or exchange accepts USDT on{' '}
              <b>BNB Smart Chain</b>. Sent to an Ethereum-only deposit address, it arrives on-chain and is never
              credited.
            </span>
          </label>
        )}
      </div>

      {/* Chain fee cards */}
      {ticker.status === 'ok' && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <ChainFeeCard
            label="BEP-20"
            fee={ticker.bscNetworkFeeXaf}
            cheapest={ticker.bscNetworkFeeXaf <= ticker.tronNetworkFeeXaf}
            active={data?.addressValid && chain === 'BSC'}
            dimmed={data?.addressValid && chain === 'TRON'}
          />
          <ChainFeeCard
            label="TRC-20"
            fee={ticker.tronNetworkFeeXaf}
            cheapest={ticker.tronNetworkFeeXaf < ticker.bscNetworkFeeXaf}
            active={data?.addressValid && chain === 'TRON'}
            dimmed={data?.addressValid && chain === 'BSC'}
          />
        </div>
      )}

      {/* Ledger */}
      <div className="mt-5 rounded-[10px] border border-rule bg-card px-5 pb-4.5 pt-5.5">
        <LedgerRow label="Rate" value={quotedRateXaf ? `${formatXaf(quotedRateXaf)} XAF · market +${marginPct}%` : '—'} />
        <LedgerRow label="Network fee" value={data?.rate ? `${formatXaf(data.rate.networkFeeXaf)} XAF` : '—'} tone="fee" />
        <LedgerRow label="Rate held" value="15 minutes" />

        {data?.provisional && (
          <div className="mt-1 text-[11px] text-muted">Assumes the cheapest network. Enter your address to confirm.</div>
        )}

        <Perforation />

        <div className="flex items-baseline justify-between">
          <span className="text-[13px] font-medium text-ink">You receive</span>
          <span className="tab text-[30px] font-semibold tracking-tight text-ink">
            {data?.usdtAmount ? formatUsdtBaseUnits(data.usdtAmount, USDT_DECIMALS[chain]) : '—'}{' '}
            <span className="text-[15px] font-normal text-muted">USDT</span>
          </span>
        </div>
      </div>

      {submitError && <div className="mt-3.5 text-xs leading-relaxed text-fault">{submitError}</div>}

      {/* Sticky CTA */}
      <div className="sticky bottom-0 -mx-5 mt-5 border-t border-rule bg-paper px-5 pb-5 pt-3.5">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit || submitting}
          className="w-full rounded-md py-3.5 text-[15px] font-semibold tracking-wide disabled:cursor-not-allowed"
          style={{
            background: canSubmit && !submitting ? 'var(--vault)' : 'var(--rule)',
            color: canSubmit && !submitting ? 'var(--paper-2)' : 'var(--muted)',
          }}
        >
          {submitting ? 'Creating order…' : ctaLabel}
        </button>
        <div className="mt-2.5 text-center text-xs text-muted">Settles in 5–15 minutes · Mon–Sat, 7am–9pm</div>
      </div>
    </>
  );
}

// Chain is an explicit choice here — the one deliberate exception to
// "never let the user pick a chain" (see CLAUDE.md "Sell flow"): there's
// no customer address to detect it from until after a deposit is sent.
function SellForm({ ticker }) {
  const navigate = useNavigate();
  const [usdtAmount, setUsdtAmount] = useState('');
  const [chain, setChain] = useState('TRON');
  const [refundAddress, setRefundAddress] = useState('');
  const [momoNumber, setMomoNumber] = useState('');
  const [momoNetwork, setMomoNetwork] = useState('MTN');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const preview = useSellQuotePreview({ usdtAmount, chain });
  const data = preview.data;

  const canSubmit = Boolean(
    ticker.status === 'ok' &&
      data?.xafAmount &&
      !data?.amountError &&
      refundAddress.trim() &&
      momoNumber.trim(),
  );

  let ctaLabel = 'Enter an amount and your details';
  if (preview.status === 'error') ctaLabel = preview.error;
  else if (data?.amountError) ctaLabel = data.amountError;
  else if (canSubmit) ctaLabel = 'Continue to deposit';

  function handleAmountInput(e) {
    setUsdtAmount(e.target.value.replace(/[^0-9.]/g, ''));
  }

  async function handleSubmit() {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await api.createSellOrder({
        usdtAmount,
        chain,
        destinationAddress: refundAddress.trim(),
        customerMomoNumber: momoNumber.trim(),
        customerMomoNetwork: momoNetwork,
      });
      saveOrderToHistory({
        reference: result.order.reference,
        xafAmount: result.order.xafAmount,
        chain: result.order.chain,
        status: result.order.status,
        createdAt: result.order.createdAt,
      });
      navigate(`/deposit/${result.order.reference}`);
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {/* Amount */}
      <div className="mt-4.5">
        <label className="mb-1.5 block text-xs text-muted" htmlFor="usdt-amount">
          You send
        </label>
        <div className="flex items-center gap-2 rounded-md border border-rule bg-card px-3.5 py-3">
          <input
            id="usdt-amount"
            type="text"
            inputMode="decimal"
            value={usdtAmount}
            onChange={handleAmountInput}
            placeholder="0"
            aria-label="Amount in USDT"
            className="tab w-full border-0 bg-transparent text-[22px] font-semibold tracking-tight text-ink outline-none"
          />
          <span className="whitespace-nowrap text-[13px] font-medium text-muted">USDT</span>
        </div>
      </div>

      {/* Chain — explicit selection */}
      <div className="mt-4">
        <div className="mb-1.5 text-xs text-muted">Sending on</div>
        <div className="grid grid-cols-2 gap-2">
          {['TRON', 'BSC'].map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setChain(c)}
              className="rounded-md border py-2.5 text-center text-sm font-medium"
              style={{
                borderColor: chain === c ? 'var(--vault)' : 'var(--rule)',
                background: chain === c ? 'rgba(63,208,143,.1)' : 'var(--card)',
                color: chain === c ? 'var(--vault)' : 'var(--ink-2)',
              }}
            >
              {CHAIN_LABELS[c]}
            </button>
          ))}
        </div>
      </div>

      {/* Refund-only wallet */}
      <div className="mt-4">
        <label className="mb-1.5 block text-xs text-muted" htmlFor="refund-address">
          Your wallet address <span className="text-muted">(for refunds only)</span>
        </label>
        <div className="rounded-md border border-rule bg-card px-3.5 py-3">
          <input
            id="refund-address"
            type="text"
            value={refundAddress}
            onChange={(e) => setRefundAddress(e.target.value)}
            spellCheck={false}
            autoCapitalize="off"
            aria-label="Your wallet address, for refunds only"
            className="mono w-full border-0 bg-transparent text-[13px] text-ink outline-none"
          />
        </div>
        <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
          We only send here if your deposit can't be matched. It is never where your XAF goes.
        </p>
      </div>

      {/* MoMo payout */}
      <div className="mt-4">
        <label className="mb-1.5 block text-xs text-muted" htmlFor="momo-number">
          MoMo number to receive your XAF
        </label>
        <div className="flex gap-2">
          <div className="flex-1 rounded-md border border-rule bg-card px-3.5 py-3">
            <input
              id="momo-number"
              type="tel"
              value={momoNumber}
              onChange={(e) => setMomoNumber(e.target.value)}
              placeholder="6XX XXX XXX"
              className="w-full border-0 bg-transparent text-sm text-ink outline-none"
            />
          </div>
          <select
            value={momoNetwork}
            onChange={(e) => setMomoNetwork(e.target.value)}
            aria-label="MoMo network"
            className="rounded-md border border-rule bg-card px-2.5 text-sm text-ink outline-none"
          >
            <option value="MTN">MTN</option>
            <option value="ORANGE">Orange</option>
          </select>
        </div>
      </div>

      {/* Ledger */}
      <div className="mt-5 rounded-[10px] border border-rule bg-card px-5 pb-4.5 pt-5.5">
        <LedgerRow
          label="Rate"
          value={data?.rate ? `${formatXaf(Math.round(Number(data.rate.quotedRateMicros) / 1_000_000))} XAF · market -${(data.rate.targetMarginBps / 100).toFixed(1)}%` : '—'}
        />
        <LedgerRow label="Rate held" value="15 minutes" />

        <Perforation />

        <div className="flex items-baseline justify-between">
          <span className="text-[13px] font-medium text-ink">You receive</span>
          <span className="tab text-[30px] font-semibold tracking-tight text-ink">
            {data?.xafAmount ? formatXaf(data.xafAmount) : '—'} <span className="text-[15px] font-normal text-muted">XAF</span>
          </span>
        </div>
      </div>

      {submitError && <div className="mt-3.5 text-xs leading-relaxed text-fault">{submitError}</div>}

      {/* Sticky CTA */}
      <div className="sticky bottom-0 -mx-5 mt-5 border-t border-rule bg-paper px-5 pb-5 pt-3.5">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit || submitting}
          className="w-full rounded-md py-3.5 text-[15px] font-semibold tracking-wide disabled:cursor-not-allowed"
          style={{
            background: canSubmit && !submitting ? 'var(--vault)' : 'var(--rule)',
            color: canSubmit && !submitting ? 'var(--paper-2)' : 'var(--muted)',
          }}
        >
          {submitting ? 'Creating order…' : ctaLabel}
        </button>
        <div className="mt-2.5 text-center text-xs text-muted">Settles in 5–15 minutes · Mon–Sat, 7am–9pm</div>
      </div>
    </>
  );
}
