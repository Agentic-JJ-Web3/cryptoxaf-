const { usdtDecimalsFor } = require('../config/chains');
const { AmountTooSmallError } = require('./errors');

const RATE_SCALE = 1_000_000n; // quotedRateMicros is XAF per USDT * 1e6

// The network fee is deducted from the amount paid, not added on top —
// what the customer types is exactly what leaves their MoMo. BigInt
// division truncates toward zero, i.e. floors here (positive operands),
// which under-delivers by dust rather than over-delivers — the safe
// direction to round in the platform's favor, never the customer's.
function computeQuote({ xafAmount, chain, rate }) {
  const netXaf = xafAmount - rate.networkFeeXaf;
  if (netXaf <= 0) {
    throw new AmountTooSmallError();
  }

  const decimals = usdtDecimalsFor(chain);
  const usdtAmount = (BigInt(netXaf) * 10n ** BigInt(decimals) * RATE_SCALE) / rate.quotedRateMicros;

  return {
    networkFeeXaf: rate.networkFeeXaf,
    marketRateMicros: rate.marketRateMicros,
    targetMarginBps: rate.targetMarginBps,
    quotedRateMicros: rate.quotedRateMicros,
    usdtAmount,
  };
}

// Sell side: usdtAmount is already base units (BigInt), converted by the
// caller via toUsdtBaseUnits — same conversion createSellOrder/preview use
// for every other USDT amount in this codebase. Floors toward the platform
// (pays out less XAF, never more), same safe direction as computeQuote.
function computeSellQuote({ usdtAmount, chain, rate }) {
  const decimals = usdtDecimalsFor(chain);
  const xafAmountBig = (usdtAmount * rate.quotedRateMicros) / (10n ** BigInt(decimals) * RATE_SCALE);
  const xafAmount = Number(xafAmountBig);

  if (!Number.isFinite(xafAmount) || xafAmount <= 0) {
    throw new AmountTooSmallError();
  }

  return {
    marketRateMicros: rate.marketRateMicros,
    targetMarginBps: rate.targetMarginBps,
    quotedRateMicros: rate.quotedRateMicros,
    xafAmount,
  };
}

module.exports = { computeQuote, computeSellQuote };
