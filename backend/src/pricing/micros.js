const MICROS_SCALE = 1_000_000n;

// Parses a decimal string like "650.5" into micros (* 1e6) without ever
// passing through a float — same representation as RateSnapshot/
// PlatformSettings.xafUsdtRateMicros.
function toMicros(decimalString) {
  const [whole, fraction = ''] = String(decimalString).split('.');
  if (fraction.length > 6) {
    throw new Error(`${decimalString} has more than 6 decimal places`);
  }
  return BigInt(whole) * MICROS_SCALE + BigInt(fraction.padEnd(6, '0') || '0');
}

// Inverse of toMicros — 650_500_000n -> "650.500000".
function fromMicros(micros) {
  const whole = micros / MICROS_SCALE;
  const fraction = (micros % MICROS_SCALE).toString().padStart(6, '0');
  return `${whole}.${fraction}`;
}

module.exports = { toMicros, fromMicros, MICROS_SCALE };
