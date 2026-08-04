export function formatXaf(amount) {
  return Number(amount).toLocaleString('en-US');
}

// baseUnits is a decimal string (BigInt-safe, as the API sends it).
// Displays exactly 2 fraction digits, truncated (never rounded up) — the
// same "round toward the platform, never the customer" direction as the
// backend's own integer division.
export function formatUsdtBaseUnits(baseUnits, decimals) {
  const value = BigInt(baseUnits);
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const divisor = 10n ** BigInt(decimals);
  const whole = abs / divisor;
  const fraction = (abs % divisor).toString().padStart(decimals, '0').slice(0, 2);
  return `${negative ? '-' : ''}${whole.toLocaleString('en-US')}.${fraction}`;
}

export function headTail(address, chars = 6) {
  if (!address) return { head: '', tail: '' };
  return { head: address.slice(0, chars), tail: address.slice(-chars) };
}

export function formatCountdown(msRemaining) {
  const totalSec = Math.max(0, Math.floor(msRemaining / 1000));
  const mm = Math.floor(totalSec / 60);
  const ss = totalSec % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

export function formatElapsedMinutes(msElapsed) {
  const totalMin = Math.max(0, Math.floor(msElapsed / 60000));
  if (totalMin < 60) return `${totalMin}m`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}
