const { RateUnavailableError } = require('./errors');

// Hard bounds on margin regardless of what's configured in PlatformSettings
// — "Clamp every quote" from CLAUDE.md. A fat-fingered admin setting (or a
// future bug in a live-feed provider) can't push a quote past these.
const MIN_MARGIN_BPS = 50; // 0.50% floor
const MAX_MARGIN_BPS = 1000; // 10% ceiling above market

function clampMarginBps(bps) {
  return Math.min(Math.max(bps, MIN_MARGIN_BPS), MAX_MARGIN_BPS);
}

async function loadFreshSettings(prisma) {
  const settings = await prisma.platformSettings.findUnique({ where: { id: 'default' } });
  if (!settings) {
    throw new RateUnavailableError('Rates have not been configured yet');
  }

  const ageSeconds = (Date.now() - settings.updatedAt.getTime()) / 1000;
  if (ageSeconds > settings.rateTtlSeconds) {
    throw new RateUnavailableError('Rate is stale');
  }

  return settings;
}

// The manual RateProvider: reads the single operator-configured settings
// row. Fails closed — no cached/guessed rate is ever returned — if the
// row is missing or hasn't been touched inside its own TTL. A live feed
// (Binance P2P, gas oracle) is a drop-in replacement behind this same
// { marketRateMicros, networkFeeXaf, targetMarginBps, quotedRateMicros }
// shape; nothing downstream needs to change when that lands.
async function getRate(prisma, chain) {
  const settings = await loadFreshSettings(prisma);

  const networkFeeXaf = chain === 'TRON' ? settings.tronNetworkFeeXaf : settings.bscNetworkFeeXaf;
  const targetMarginBps = clampMarginBps(settings.targetMarginBps);
  const quotedRateMicros = (settings.xafUsdtRateMicros * BigInt(10000 + targetMarginBps)) / 10000n;

  return {
    marketRateMicros: settings.xafUsdtRateMicros,
    networkFeeXaf,
    targetMarginBps,
    quotedRateMicros,
    updatedAt: settings.updatedAt,
  };
}

// The market rate and both chains' flat fees, with no address needed —
// the swap screen's live ticker and the chain fee-comparison cards both
// need this before the customer has typed anything.
async function getMarketRate(prisma) {
  const settings = await loadFreshSettings(prisma);
  return {
    marketRateMicros: settings.xafUsdtRateMicros,
    tronNetworkFeeXaf: settings.tronNetworkFeeXaf,
    bscNetworkFeeXaf: settings.bscNetworkFeeXaf,
    updatedAt: settings.updatedAt,
  };
}

module.exports = { getRate, getMarketRate, clampMarginBps, MIN_MARGIN_BPS, MAX_MARGIN_BPS };
