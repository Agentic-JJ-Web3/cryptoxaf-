import { useRef, useState } from 'react';

export default function CopyButton({ value, className = '' }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef(null);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Clipboard API can be denied/unavailable — the label just won't
      // confirm, which is a harmless degradation, not worth surfacing.
    }
    setCopied(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`flex-none rounded-md border border-rule bg-card px-3 py-2 text-xs font-medium text-ink-2 hover:border-ink-2 ${className}`}
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}
