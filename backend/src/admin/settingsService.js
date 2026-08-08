const { toMicros, fromMicros } = require('../pricing/micros');
const {
  clampMarginBps,
  clampSellMarginBps,
  MIN_MARGIN_BPS,
  MAX_MARGIN_BPS,
  MIN_SELL_MARGIN_BPS,
  MAX_SELL_MARGIN_BPS,
} = require('../pricing/rateProvider');
const { validateDestinationAddress } = require('../validation/address');
const { AddressInvalidError } = require('../validation/errors');

// bps -> percent for the operator-facing form; the stored/clamp math stays
// in bps (rateProvider.js) so this is purely a display-boundary conversion.
function bpsToPct(bps) {
  return bps / 100;
}

// Exposed independent of whether a settings row exists yet, so the admin
// UI can render the safety-rail preview even before the very first save.
const MARGIN_CLAMP_RANGE_PCT = { min: bpsToPct(MIN_MARGIN_BPS), max: bpsToPct(MAX_MARGIN_BPS) };
const SELL_MARGIN_CLAMP_RANGE_PCT = { min: bpsToPct(MIN_SELL_MARGIN_BPS), max: bpsToPct(MAX_SELL_MARGIN_BPS) };

function serialize(settings) {
  const sellConfigured = settings.sellMarginBps != null;
  return {
    xafUsdtRate: fromMicros(settings.xafUsdtRateMicros),
    tronNetworkFeeXaf: settings.tronNetworkFeeXaf,
    bscNetworkFeeXaf: settings.bscNetworkFeeXaf,
    targetMarginPct: bpsToPct(settings.targetMarginBps),
    // What will actually be quoted once rateProvider.js's own clamp runs —
    // shown so an out-of-range save doesn't silently do nothing visible.
    effectiveMarginPct: bpsToPct(clampMarginBps(settings.targetMarginBps)),
    marginClampRangePct: MARGIN_CLAMP_RANGE_PCT,
    rateTtlSeconds: settings.rateTtlSeconds,
    momoNetwork: settings.momoNetwork,
    momoNumber: settings.momoNumber,
    momoAccountName: settings.momoAccountName,
    // Sell (USDT -> XAF) — all null until an operator turns it on. Same
    // "unset = unavailable" fail-closed posture as rateProvider.getSellRate.
    sellMarginPct: sellConfigured ? bpsToPct(settings.sellMarginBps) : null,
    sellEffectiveMarginPct: sellConfigured ? bpsToPct(clampSellMarginBps(settings.sellMarginBps)) : null,
    sellMarginClampRangePct: SELL_MARGIN_CLAMP_RANGE_PCT,
    sellDepositAddressTron: settings.sellDepositAddressTron,
    sellDepositAddressBsc: settings.sellDepositAddressBsc,
    sellAvailable: sellConfigured && !!settings.sellDepositAddressTron && !!settings.sellDepositAddressBsc,
    openHour: settings.openHour,
    closeHour: settings.closeHour,
    openWeekdays: settings.openWeekdays,
    updatedAt: settings.updatedAt,
    updatedBy: settings.updatedBy,
  };
}

async function getSettings(prisma) {
  const settings = await prisma.platformSettings.findUnique({ where: { id: 'default' } });
  return settings ? serialize(settings) : null;
}

// A platform deposit address is validated the same way a customer's
// destination address is — getting the platform's own receiving address
// wrong is at least as costly as getting a customer's wrong. Empty/unset
// means "sell isn't configured for this chain yet", not an error.
async function validateSellDepositAddress(address, expectedChain) {
  const trimmed = (address || '').trim();
  if (!trimmed) return null;

  const { chain, normalizedAddress } = await validateDestinationAddress(trimmed);
  if (chain !== expectedChain) {
    throw new AddressInvalidError(`That doesn't look like a ${expectedChain === 'TRON' ? 'Tron' : 'BSC'} address.`);
  }
  return normalizedAddress;
}

async function updateSettings(prisma, { operator, data, ip, userAgent }) {
  const before = await prisma.platformSettings.findUnique({ where: { id: 'default' } });

  const [sellDepositAddressTron, sellDepositAddressBsc] = await Promise.all([
    validateSellDepositAddress(data.sellDepositAddressTron, 'TRON'),
    validateSellDepositAddress(data.sellDepositAddressBsc, 'BSC'),
  ]);

  const updateData = {
    xafUsdtRateMicros: toMicros(data.xafUsdtRate),
    tronNetworkFeeXaf: data.tronNetworkFeeXaf,
    bscNetworkFeeXaf: data.bscNetworkFeeXaf,
    targetMarginBps: Math.round(data.targetMarginPct * 100),
    rateTtlSeconds: data.rateTtlSeconds,
    momoNetwork: data.momoNetwork,
    momoNumber: data.momoNumber,
    momoAccountName: data.momoAccountName,
    sellMarginBps: data.sellMarginPct == null ? null : Math.round(data.sellMarginPct * 100),
    sellDepositAddressTron,
    sellDepositAddressBsc,
    openHour: data.openHour,
    closeHour: data.closeHour,
    openWeekdays: data.openWeekdays,
    updatedBy: `operator:${operator.id}`,
  };

  const settings = await prisma.platformSettings.upsert({
    where: { id: 'default' },
    update: updateData,
    create: { id: 'default', ...updateData },
  });

  const after = serialize(settings);
  await prisma.adminAuditLog.create({
    data: {
      actor: `operator:${operator.id}`,
      action: 'settings.update',
      ip,
      userAgent,
      metadata: { before: before ? serialize(before) : null, after },
    },
  });

  return after;
}

module.exports = { getSettings, updateSettings, serialize, MARGIN_CLAMP_RANGE_PCT, SELL_MARGIN_CLAMP_RANGE_PCT };
