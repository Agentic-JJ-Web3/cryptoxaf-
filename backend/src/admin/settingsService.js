const { toMicros, fromMicros } = require('../pricing/micros');
const { clampMarginBps, MIN_MARGIN_BPS, MAX_MARGIN_BPS } = require('../pricing/rateProvider');

// bps -> percent for the operator-facing form; the stored/clamp math stays
// in bps (rateProvider.js) so this is purely a display-boundary conversion.
function bpsToPct(bps) {
  return bps / 100;
}

// Exposed independent of whether a settings row exists yet, so the admin
// UI can render the safety-rail preview even before the very first save.
const MARGIN_CLAMP_RANGE_PCT = { min: bpsToPct(MIN_MARGIN_BPS), max: bpsToPct(MAX_MARGIN_BPS) };

function serialize(settings) {
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
    updatedAt: settings.updatedAt,
    updatedBy: settings.updatedBy,
  };
}

async function getSettings(prisma) {
  const settings = await prisma.platformSettings.findUnique({ where: { id: 'default' } });
  return settings ? serialize(settings) : null;
}

async function updateSettings(prisma, { operator, data, ip, userAgent }) {
  const before = await prisma.platformSettings.findUnique({ where: { id: 'default' } });

  const updateData = {
    xafUsdtRateMicros: toMicros(data.xafUsdtRate),
    tronNetworkFeeXaf: data.tronNetworkFeeXaf,
    bscNetworkFeeXaf: data.bscNetworkFeeXaf,
    targetMarginBps: Math.round(data.targetMarginPct * 100),
    rateTtlSeconds: data.rateTtlSeconds,
    momoNetwork: data.momoNetwork,
    momoNumber: data.momoNumber,
    momoAccountName: data.momoAccountName,
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

module.exports = { getSettings, updateSettings, serialize, MARGIN_CLAMP_RANGE_PCT };
