import { useEffect, useState } from 'react';
import { adminApi, ApiError } from '../../api/client';
import { formatXaf } from '../../lib/format';

const EMPTY_DRAFT = {
  xafUsdtRate: '',
  tronNetworkFeeXaf: 0,
  bscNetworkFeeXaf: 0,
  targetMarginPct: 0,
  rateTtlSeconds: 86400,
  momoNetwork: 'MTN',
  momoNumber: '',
  momoAccountName: '',
};

function draftFromSettings(settings) {
  if (!settings) return EMPTY_DRAFT;
  const { xafUsdtRate, tronNetworkFeeXaf, bscNetworkFeeXaf, targetMarginPct, rateTtlSeconds, momoNetwork, momoNumber, momoAccountName } =
    settings;
  return { xafUsdtRate, tronNetworkFeeXaf, bscNetworkFeeXaf, targetMarginPct, rateTtlSeconds, momoNetwork, momoNumber, momoAccountName };
}

export default function AdminSettingsPage() {
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [marginRange, setMarginRange] = useState({ min: 0.5, max: 10 });
  const [live, setLive] = useState(EMPTY_DRAFT);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await adminApi.getSettings();
        if (cancelled) return;
        setMarginRange(res.marginClampRangePct);
        const next = draftFromSettings(res.settings);
        setLive(next);
        setDraft(next);
        setStatus('ready');
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : 'Could not load settings.');
        setStatus('error');
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (status === 'loading') {
    return <div className="text-sm text-muted">Loading settings…</div>;
  }
  if (status === 'error') {
    return <div className="text-sm text-fault">{error}</div>;
  }

  function update(field, value) {
    setJustSaved(false);
    setDraft((d) => ({ ...d, [field]: value }));
  }

  const isDirty = JSON.stringify(draft) !== JSON.stringify(live);
  const marketRate = Number(draft.xafUsdtRate) || 0;
  const rawQuote = Math.round(marketRate * (1 + draft.targetMarginPct / 100));
  const clampedPct = Math.min(Math.max(draft.targetMarginPct, marginRange.min), marginRange.max);
  const clampedQuote = Math.round(marketRate * (1 + clampedPct / 100));
  const isClamped = clampedPct !== draft.targetMarginPct;

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await adminApi.updateSettings(draft);
      const next = draftFromSettings(res.settings);
      setLive(next);
      setDraft(next);
      setJustSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save settings.');
    } finally {
      setSaving(false);
    }
  }

  function handleDiscard() {
    setDraft(live);
    setJustSaved(false);
  }

  return (
    <div className="max-w-[560px]">
      <div className="border-b border-rule pb-4">
        <div className="text-[19px] font-semibold">Operator settings</div>
        <p className="mt-1.5 text-xs text-muted">Changes preview instantly below. Nothing reaches customers until you save.</p>
      </div>

      {error && <div className="mt-3 text-sm text-fault">{error}</div>}

      <Section title="Market rate & margin">
        <Field label="Market rate (XAF per USDT)">
          <input
            type="text"
            inputMode="decimal"
            value={draft.xafUsdtRate}
            onChange={(e) => update('xafUsdtRate', e.target.value)}
            className="tab w-full border-0 bg-transparent text-lg font-semibold text-ink outline-none"
          />
        </Field>
        <Field label="Margin over market rate (%)">
          <input
            type="number"
            step="0.1"
            value={draft.targetMarginPct}
            onChange={(e) => update('targetMarginPct', parseFloat(e.target.value) || 0)}
            className="tab w-full border-0 bg-transparent text-lg font-semibold text-ink outline-none"
          />
        </Field>

        <div className="mt-3.5 rounded-lg border border-rule bg-paper-2 px-4 py-3.5">
          <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-muted">Preview</div>
          <PreviewRow label="Market rate" value={`${formatXaf(marketRate)} XAF`} />
          <PreviewRow label="Quoted before safety rail" value={`${formatXaf(rawQuote)} XAF`} />
          <PreviewRow label="Quoted to customers" value={`${formatXaf(clampedQuote)} XAF`} strong />
          {isClamped && (
            <div className="mt-1.5 text-[11px] text-fee">
              Clamped by the safety rail — margin is stored at {draft.targetMarginPct}% but quotes will use{' '}
              {clampedPct.toFixed(2)}% ({marginRange.min}%–{marginRange.max}% allowed).
            </div>
          )}
        </div>
      </Section>

      <Section title="Network fees, XAF">
        <div className="grid grid-cols-2 gap-2.5">
          <Field label="Tron (TRC-20)">
            <input
              type="number"
              value={draft.tronNetworkFeeXaf}
              onChange={(e) => update('tronNetworkFeeXaf', parseInt(e.target.value, 10) || 0)}
              className="tab w-full border-0 bg-transparent text-[15px] font-semibold text-ink outline-none"
            />
          </Field>
          <Field label="BSC (BEP-20)">
            <input
              type="number"
              value={draft.bscNetworkFeeXaf}
              onChange={(e) => update('bscNetworkFeeXaf', parseInt(e.target.value, 10) || 0)}
              className="tab w-full border-0 bg-transparent text-[15px] font-semibold text-ink outline-none"
            />
          </Field>
        </div>
      </Section>

      <Section title="Rate freshness">
        <Field label="Rate TTL (seconds)">
          <input
            type="number"
            value={draft.rateTtlSeconds}
            onChange={(e) => update('rateTtlSeconds', parseInt(e.target.value, 10) || 0)}
            className="tab w-full border-0 bg-transparent text-[15px] font-semibold text-ink outline-none"
          />
        </Field>
        <p className="mt-1.5 text-xs text-muted">Quotes fail closed once this settings row is older than the TTL.</p>
      </Section>

      <Section title="MoMo shown to customers" last>
        <div className="grid grid-cols-2 gap-2.5">
          <Field label="Network">
            <select
              value={draft.momoNetwork}
              onChange={(e) => update('momoNetwork', e.target.value)}
              className="w-full border-0 bg-transparent text-[15px] font-medium text-ink outline-none"
            >
              <option value="MTN">MTN</option>
              <option value="ORANGE">Orange</option>
            </select>
          </Field>
          <Field label="Number">
            <input
              type="text"
              value={draft.momoNumber}
              onChange={(e) => update('momoNumber', e.target.value)}
              className="w-full border-0 bg-transparent font-mono text-[14px] text-ink outline-none"
            />
          </Field>
        </div>
        <Field label="Account name">
          <input
            type="text"
            value={draft.momoAccountName}
            onChange={(e) => update('momoAccountName', e.target.value)}
            className="w-full border-0 bg-transparent text-[14px] text-ink outline-none"
          />
        </Field>
      </Section>

      {isDirty && (
        <div className="sticky bottom-0 flex gap-2.5 border-t border-rule bg-paper py-3.5">
          <button
            type="button"
            onClick={handleDiscard}
            disabled={saving}
            className="flex-1 rounded-md border border-rule bg-card py-3.5 text-sm font-medium text-ink-2"
          >
            Discard
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-[2] rounded-md bg-vault py-3.5 text-sm font-semibold text-paper-2 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      )}
      {justSaved && !isDirty && (
        <div className="py-3 text-center text-xs text-muted">Saved — live for customers now.</div>
      )}
    </div>
  );
}

function Section({ title, children, last = false }) {
  return (
    <div className={`py-4.5 ${last ? '' : 'border-b border-rule-soft'}`}>
      <div className="mb-3 font-mono text-[10px] uppercase tracking-wider text-muted">{title}</div>
      {children}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="mb-3.5 block last:mb-0">
      <span className="mb-1.5 block text-xs text-muted">{label}</span>
      <div className="rounded-md border border-rule bg-card px-3.5 py-3">{children}</div>
    </label>
  );
}

function PreviewRow({ label, value, strong = false }) {
  return (
    <div className="flex items-baseline py-[3px] text-[13px]">
      <span className={strong ? 'font-semibold text-ink' : 'text-muted'}>{label}</span>
      <span
        className="mx-2 min-w-[14px] flex-1 border-b border-dotted border-rule"
        style={{ transform: 'translateY(-4px)' }}
      />
      <span className={`tab ${strong ? 'font-semibold text-ink' : 'text-ink-2'}`}>{value}</span>
    </div>
  );
}
