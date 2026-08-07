import { useCallback, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { adminApi, ApiError } from '../../api/client';
import CopyButton from '../../components/CopyButton';
import LedgerRow from '../../components/LedgerRow';
import { formatXaf, formatUsdtBaseUnits, headTail } from '../../lib/format';
import { USDT_DECIMALS, CHAIN_LABELS } from '../../lib/chains';
import { adminStateMeta } from '../../lib/adminOrderState';

export default function AdminOrderDetailPage() {
  const { reference } = useParams();
  const [state, setState] = useState({ status: 'loading', order: null, error: null });

  const load = useCallback(async () => {
    try {
      const { order } = await adminApi.getOrder(reference);
      setState({ status: 'ready', order, error: null });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Could not load this order.';
      setState((s) => ({ status: 'error', order: s.order, error: message }));
    }
  }, [reference]);

  useEffect(() => {
    load();
  }, [load]);

  if (state.status === 'loading') {
    return <div className="text-sm text-muted">Loading order…</div>;
  }
  if (!state.order) {
    return (
      <div>
        <div className="text-sm text-fault">{state.error}</div>
        <Link to="/admin/queue" className="mt-3 inline-block text-sm font-semibold text-vault">
          &larr; Back to queue
        </Link>
      </div>
    );
  }

  const { order } = state;
  const isSell = order.direction === 'SELL';
  const meta = adminStateMeta(order.status);
  const { head: addrHead, tail: addrTail } = headTail(order.destinationAddress);
  const addrMid = order.destinationAddress.slice(6, -6);

  return (
    <div className="max-w-[820px]">
      <Link to="/admin/queue" className="mb-4 inline-block text-xs font-medium text-muted hover:text-ink-2">
        &larr; Queue
      </Link>

      <div className="flex items-center justify-between border-b border-rule pb-4">
        <div>
          <div className="mb-1.5 flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-muted">
            Order detail
            <span
              className="rounded border px-1.5 py-0.5 text-[9px] font-semibold"
              style={{ borderColor: isSell ? 'var(--fee)' : 'var(--vault)', color: isSell ? 'var(--fee)' : 'var(--vault)' }}
            >
              {isSell ? 'SELL' : 'BUY'}
            </span>
          </div>
          <div className="font-mono text-[22px] font-medium">{order.reference}</div>
        </div>
        <div className="text-right text-xs font-semibold" style={{ color: meta.color }}>
          {meta.label}
        </div>
      </div>

      {state.status === 'error' && <div className="mt-3 text-sm text-fault">{state.error}</div>}

      <div className="border-b border-rule-soft py-4.5">
        <div className="mb-2.5 font-mono text-[10px] uppercase tracking-wider text-muted">Record</div>
        {isSell ? (
          <>
            <LedgerRow label="Deposit tx hash" value={order.paymentReference || (order.depositReceiptImagePath ? 'screenshot only' : '—')} />
            <LedgerRow label="Payout MoMo number" value={order.customerMomoNumber ? `${order.customerMomoNumber} · ${order.customerMomoNetwork}` : '—'} />
            <LedgerRow label="Amount sent" value={`${formatUsdtBaseUnits(order.usdtAmount, USDT_DECIMALS[order.chain])} USDT`} />
          </>
        ) : (
          <>
            <LedgerRow label="MoMo transaction ID" value={order.paymentReference || '—'} />
            <LedgerRow label="Customer MoMo number" value={order.customerMomoNumber || '—'} />
            <LedgerRow label="Amount paid" value={`${formatXaf(order.xafAmount)} XAF`} />
          </>
        )}
        {order.rateSnapshot && (
          <>
            <LedgerRow label="Rate applied" value={`${formatXaf(Math.round(Number(order.rateSnapshot.quotedRateMicros) / 1e6))} XAF`} />
            {!isSell && <LedgerRow label="Network fee" value={`${formatXaf(order.rateSnapshot.networkFeeXaf)} XAF`} tone="fee" />}
          </>
        )}
        {isSell ? (
          <LedgerRow label="XAF owed" value={`${formatXaf(order.xafAmount)} XAF`} />
        ) : (
          <LedgerRow label="USDT owed" value={`${formatUsdtBaseUnits(order.usdtAmount, USDT_DECIMALS[order.chain])} USDT`} />
        )}
        <LedgerRow label="Chain" value={CHAIN_LABELS[order.chain]} />
      </div>

      <div className="border-b border-rule-soft py-4.5">
        <div className="mb-2.5 flex items-center justify-between">
          <div className="font-mono text-[10px] uppercase tracking-wider text-muted">
            {isSell ? 'Customer wallet (refund only)' : 'Destination wallet'}
          </div>
          <CopyButton value={order.destinationAddress} />
        </div>
        <div className="break-all font-mono text-sm leading-relaxed" style={{ color: 'var(--rule)' }}>
          <span style={{ color: 'var(--ink)', fontWeight: 500 }}>{addrHead}</span>
          <span>{addrMid}</span>
          <span style={{ color: 'var(--ink)', fontWeight: 500 }}>{addrTail}</span>
        </div>
      </div>

      <StagePanel order={order} onChanged={load} />

      <div className="py-4.5">
        <div className="mb-2.5 font-mono text-[10px] uppercase tracking-wider text-muted">Action log</div>
        <div className="flex flex-col gap-1">
          {order.auditLogs.map((entry) => (
            <div key={entry.id} className="flex gap-3 py-1 text-xs">
              <span className="w-16 flex-none font-mono text-muted">
                {new Date(entry.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              <span className="text-ink-2">
                {entry.fromStatus ? `${entry.fromStatus} → ${entry.toStatus}` : entry.toStatus}
                {entry.note ? ` · ${entry.note}` : ''}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StagePanel({ order, onChanged }) {
  switch (order.status) {
    case 'AWAITING_PAYMENT':
      return (
        <Panel title="Waiting on the customer">
          <p className="text-[13px] leading-relaxed text-ink-2">
            The customer has not yet submitted a MoMo payment ID. Nothing to do here yet.
          </p>
        </Panel>
      );
    case 'PAYMENT_CLAIMED':
      return <VerifyStage order={order} onChanged={onChanged} />;
    case 'PAYMENT_VERIFIED':
      return <PayoutStage order={order} onChanged={onChanged} />;
    case 'AWAITING_DEPOSIT':
      return (
        <Panel title="Waiting on the customer">
          <p className="text-[13px] leading-relaxed text-ink-2">
            The customer has not yet submitted a deposit tx hash or screenshot. Nothing to do here yet.
          </p>
        </Panel>
      );
    case 'DEPOSIT_CLAIMED':
      return <DepositVerifyStage order={order} onChanged={onChanged} />;
    case 'DEPOSIT_VERIFIED':
      return <SellPayoutStage order={order} onChanged={onChanged} />;
    case 'REFUND_DUE':
      return <RefundStage order={order} onChanged={onChanged} />;
    case 'COMPLETED':
      return (
        <Panel title="Sent · record closed" titleColor="var(--live)">
          <div className="break-all rounded-lg border border-rule bg-card px-3.5 py-3 font-mono text-[13px] text-ink-2">
            {order.payoutReference}
          </div>
        </Panel>
      );
    case 'REFUNDED':
      return (
        <Panel title="Refunded">
          <p className="text-[13px] leading-relaxed text-ink-2">{order.refundReason || 'Refund sent.'}</p>
        </Panel>
      );
    case 'EXPIRED':
      return (
        <Panel title="Quote expired">
          <p className="text-[13px] leading-relaxed text-ink-2">This quote lapsed before payment arrived.</p>
        </Panel>
      );
    default:
      return null;
  }
}

function Panel({ title, titleColor, children }) {
  return (
    <div className="border-b border-rule-soft py-5">
      <div className="mb-1.5 text-[15px] font-semibold" style={titleColor ? { color: titleColor } : undefined}>
        {title}
      </div>
      {children}
    </div>
  );
}

function ActionError({ message, onRefresh }) {
  if (!message) return null;
  return (
    <div className="mb-3 text-[13px] text-fault">
      {message}
      {onRefresh && (
        <button type="button" onClick={onRefresh} className="ml-2 font-semibold underline">
          Refresh
        </button>
      )}
    </div>
  );
}

function VerifyStage({ order, onChanged }) {
  const [checked, setChecked] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await adminApi.verifyPayment(order.reference);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not confirm payment.');
    } finally {
      setBusy(false);
    }
  }

  async function confirmReject() {
    setBusy(true);
    setError(null);
    try {
      await adminApi.rejectPayment(order.reference, reason.trim());
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reject payment.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title="Stage 1 · verify payment">
      <p className="mb-3.5 text-[13px] leading-relaxed text-ink-2">
        Check your own MoMo app for a payment of <b>{formatXaf(order.xafAmount)} XAF</b> with transaction ID{' '}
        <span className="font-mono">{order.paymentReference}</span> from {order.customerMomoNumber}.
      </p>

      <ActionError message={error} onRefresh={onChanged} />

      {!rejecting ? (
        <>
          <label className="mb-3.5 flex items-start gap-2.5 text-[13px] text-ink-2">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="mt-0.5 flex-none accent-vault"
            />
            <span>I have checked this against our MoMo app and it matches exactly.</span>
          </label>
          <div className="flex gap-2.5">
            <button
              type="button"
              disabled={!checked || busy}
              onClick={confirm}
              className="flex-1 rounded-md bg-vault py-3.5 text-sm font-semibold text-paper-2 disabled:bg-rule disabled:text-muted"
            >
              Confirm payment received
            </button>
            <button
              type="button"
              onClick={() => setRejecting(true)}
              className="flex-none rounded-md border border-fault px-4 py-3.5 text-sm font-semibold text-fault"
            >
              Reject
            </button>
          </div>
        </>
      ) : (
        <>
          <label className="mb-1.5 block text-xs text-muted">Reason for rejection</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. transaction ID does not match any received payment"
            rows={3}
            className="mb-3 w-full resize-y rounded-md border border-rule bg-card px-3 py-2.5 text-[13px] text-ink"
          />
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={() => {
                setRejecting(false);
                setReason('');
              }}
              className="flex-1 rounded-md border border-rule bg-card py-3.5 text-sm font-medium text-ink-2"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!reason.trim() || busy}
              onClick={confirmReject}
              className="flex-1 rounded-md bg-fault py-3.5 text-sm font-semibold text-white disabled:bg-rule disabled:text-muted"
            >
              Confirm rejection
            </button>
          </div>
        </>
      )}
    </Panel>
  );
}

function PayoutStage({ order, onChanged }) {
  const [txHash, setTxHash] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function confirmSend() {
    setBusy(true);
    setError(null);
    try {
      await adminApi.completeOrder(order.reference, txHash.trim());
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not mark this order as sent.');
      setBusy(false);
    }
  }

  return (
    <Panel title="Stage 2 · send crypto">
      <p className="mb-3.5 text-[13px] leading-relaxed text-ink-2">
        Payment confirmed. Send{' '}
        <b>{formatUsdtBaseUnits(order.usdtAmount, USDT_DECIMALS[order.chain])} USDT</b> on{' '}
        {CHAIN_LABELS[order.chain]} to the address above, then record the transaction hash.
      </p>

      <ActionError message={error} onRefresh={onChanged} />

      {!confirming ? (
        <>
          <label className="mb-1.5 block text-xs text-muted">Transaction hash</label>
          <input
            type="text"
            value={txHash}
            onChange={(e) => setTxHash(e.target.value)}
            placeholder="paste after sending"
            spellCheck={false}
            autoCapitalize="off"
            className="mb-3.5 w-full rounded-md border border-rule bg-card px-3.5 py-3 font-mono text-[13px] text-ink"
          />
          <button
            type="button"
            disabled={!txHash.trim()}
            onClick={() => setConfirming(true)}
            className="w-full rounded-md bg-vault py-3.5 text-sm font-semibold text-paper-2 disabled:bg-rule disabled:text-muted"
          >
            Mark as sent
          </button>
        </>
      ) : (
        <div className="rounded-lg border border-fee bg-fee-bg p-4">
          <div className="mb-1.5 text-[13px] font-semibold text-fee">This cannot be undone</div>
          <p className="mb-3.5 text-[13px] leading-relaxed text-ink-2">
            You are about to send <b>{formatUsdtBaseUnits(order.usdtAmount, USDT_DECIMALS[order.chain])} USDT</b> to{' '}
            <span className="font-mono">
              {order.destinationAddress.slice(0, 6)}…{order.destinationAddress.slice(-6)}
            </span>{' '}
            on {CHAIN_LABELS[order.chain]}.
          </p>
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={busy}
              className="flex-1 rounded-md border border-rule bg-card py-3.5 text-sm font-medium text-ink-2"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmSend}
              disabled={busy}
              className="flex-1 rounded-md bg-vault py-3.5 text-sm font-semibold text-paper-2"
            >
              Confirm send
            </button>
          </div>
        </div>
      )}
    </Panel>
  );
}

function ReceiptImage({ reference }) {
  const [url, setUrl] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl = null;

    adminApi
      .getReceiptBlob(reference)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : 'Could not load the screenshot.');
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [reference]);

  if (error) return <div className="text-xs text-fault">{error}</div>;
  if (!url) return <div className="text-xs text-muted">Loading screenshot…</div>;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer">
      <img src={url} alt="Customer-submitted deposit receipt" className="max-h-72 w-full rounded-md border border-rule object-contain" />
    </a>
  );
}

function DepositVerifyStage({ order, onChanged }) {
  const [checkResult, setCheckResult] = useState(null);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function runCheck() {
    setChecking(true);
    setCheckError(null);
    try {
      const result = await adminApi.checkDeposit(order.reference);
      setCheckResult(result);
    } catch (err) {
      setCheckError(err instanceof ApiError ? err.message : 'Could not check this transaction.');
    } finally {
      setChecking(false);
    }
  }

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await adminApi.verifyDeposit(order.reference);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not confirm this deposit.');
      setBusy(false);
    }
  }

  async function confirmReject() {
    setBusy(true);
    setError(null);
    try {
      await adminApi.rejectDeposit(order.reference, reason.trim());
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reject this deposit.');
      setBusy(false);
    }
  }

  return (
    <Panel title="Stage 1 · verify deposit">
      <p className="mb-3.5 text-[13px] leading-relaxed text-ink-2">
        The customer says they sent <b>{formatUsdtBaseUnits(order.usdtAmount, USDT_DECIMALS[order.chain])} USDT</b> on{' '}
        {CHAIN_LABELS[order.chain]}.
      </p>

      {order.depositReceiptImagePath && (
        <div className="mb-3.5">
          <div className="mb-1.5 text-xs text-muted">Customer-submitted screenshot</div>
          <ReceiptImage reference={order.reference} />
        </div>
      )}

      {order.paymentReference && (
        <div className="mb-3.5">
          <button
            type="button"
            onClick={runCheck}
            disabled={checking}
            className="w-full rounded-md border border-rule bg-card py-2.5 text-xs font-semibold text-ink-2 disabled:opacity-60"
          >
            {checking ? 'Checking on-chain…' : 'Check on-chain'}
          </button>
          {checkError && <div className="mt-2 text-xs text-fault">{checkError}</div>}
          {checkResult && (
            <div
              className="mt-2 rounded-md border px-3 py-2.5 text-xs leading-relaxed"
              style={{
                borderColor: checkResult.matches ? 'var(--vault)' : 'var(--fault)',
                background: checkResult.matches ? 'rgba(63,208,143,.08)' : 'var(--fault-bg)',
                color: checkResult.matches ? 'var(--ink)' : 'var(--fault)',
              }}
            >
              {checkResult.matches ? (
                <>Match — {formatUsdtBaseUnits(checkResult.actualAmountBase, USDT_DECIMALS[order.chain])} USDT to our deposit address.</>
              ) : (
                checkResult.reason
              )}
            </div>
          )}
        </div>
      )}

      <ActionError message={error} onRefresh={onChanged} />

      {!rejecting ? (
        <>
          <label className="mb-3.5 flex items-start gap-2.5 text-[13px] text-ink-2">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="mt-0.5 flex-none accent-vault"
            />
            <span>I've confirmed this deposit — from the check above, the screenshot, or the explorer directly.</span>
          </label>
          <div className="flex gap-2.5">
            <button
              type="button"
              disabled={!checked || busy}
              onClick={confirm}
              className="flex-1 rounded-md bg-vault py-3.5 text-sm font-semibold text-paper-2 disabled:bg-rule disabled:text-muted"
            >
              Confirm deposit received
            </button>
            <button
              type="button"
              onClick={() => setRejecting(true)}
              className="flex-none rounded-md border border-fault px-4 py-3.5 text-sm font-semibold text-fault"
            >
              Reject
            </button>
          </div>
        </>
      ) : (
        <>
          <label className="mb-1.5 block text-xs text-muted">Reason for rejection</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. amount doesn't match, or nothing found on-chain"
            rows={3}
            className="mb-3 w-full resize-y rounded-md border border-rule bg-card px-3 py-2.5 text-[13px] text-ink"
          />
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={() => {
                setRejecting(false);
                setReason('');
              }}
              className="flex-1 rounded-md border border-rule bg-card py-3.5 text-sm font-medium text-ink-2"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!reason.trim() || busy}
              onClick={confirmReject}
              className="flex-1 rounded-md bg-fault py-3.5 text-sm font-semibold text-white disabled:bg-rule disabled:text-muted"
            >
              Confirm rejection
            </button>
          </div>
        </>
      )}
    </Panel>
  );
}

function SellPayoutStage({ order, onChanged }) {
  const [payoutReference, setPayoutReference] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function confirmSend() {
    setBusy(true);
    setError(null);
    try {
      await adminApi.completeSellOrder(order.reference, payoutReference.trim());
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not mark this order as sent.');
      setBusy(false);
    }
  }

  return (
    <Panel title="Stage 2 · send MoMo payout">
      <p className="mb-3.5 text-[13px] leading-relaxed text-ink-2">
        Deposit confirmed. Send <b>{formatXaf(order.xafAmount)} XAF</b> via MoMo to{' '}
        <span className="font-mono">{order.customerMomoNumber}</span> ({order.customerMomoNetwork}), then record
        the confirmation code.
      </p>

      <ActionError message={error} onRefresh={onChanged} />

      {!confirming ? (
        <>
          <label className="mb-1.5 block text-xs text-muted">MoMo confirmation code</label>
          <input
            type="text"
            value={payoutReference}
            onChange={(e) => setPayoutReference(e.target.value)}
            placeholder="paste after sending"
            spellCheck={false}
            autoCapitalize="off"
            className="mb-3.5 w-full rounded-md border border-rule bg-card px-3.5 py-3 font-mono text-[13px] text-ink"
          />
          <button
            type="button"
            disabled={!payoutReference.trim()}
            onClick={() => setConfirming(true)}
            className="w-full rounded-md bg-vault py-3.5 text-sm font-semibold text-paper-2 disabled:bg-rule disabled:text-muted"
          >
            Mark as sent
          </button>
        </>
      ) : (
        <div className="rounded-lg border border-fee bg-fee-bg p-4">
          <div className="mb-1.5 text-[13px] font-semibold text-fee">This cannot be undone</div>
          <p className="mb-3.5 text-[13px] leading-relaxed text-ink-2">
            You are about to mark <b>{formatXaf(order.xafAmount)} XAF</b> as sent to{' '}
            <span className="font-mono">{order.customerMomoNumber}</span>.
          </p>
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={busy}
              className="flex-1 rounded-md border border-rule bg-card py-3.5 text-sm font-medium text-ink-2"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmSend}
              disabled={busy}
              className="flex-1 rounded-md bg-vault py-3.5 text-sm font-semibold text-paper-2"
            >
              Confirm send
            </button>
          </div>
        </div>
      )}
    </Panel>
  );
}

function RefundStage({ order, onChanged }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function confirmRefund() {
    setBusy(true);
    setError(null);
    try {
      await adminApi.refundOrder(order.reference, note.trim() || undefined);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not mark this refund as sent.');
      setBusy(false);
    }
  }

  return (
    <Panel title="Rejected · refund due" titleColor="var(--fault)">
      <p className="mb-3.5 text-[13px] leading-relaxed text-ink-2">{order.refundReason}</p>

      <ActionError message={error} onRefresh={onChanged} />

      <label className="mb-1.5 block text-xs text-muted">Note (optional)</label>
      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="e.g. sent back via MoMo"
        className="mb-3.5 w-full rounded-md border border-rule bg-card px-3.5 py-3 text-[13px] text-ink"
      />
      <button
        type="button"
        disabled={busy}
        onClick={confirmRefund}
        className="w-full rounded-md bg-fault py-3.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        Mark refund sent
      </button>
    </Panel>
  );
}
