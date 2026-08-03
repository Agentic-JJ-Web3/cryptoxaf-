const { decimalToBigInt } = require('../db/money');
const { transitionOrder, IllegalTransitionError } = require('./orderService');

const EXPIRABLE_STATUSES = new Set(['QUOTED', 'AWAITING_PAYMENT']);

// Order objects from a raw prisma.order.findUnique() carry usdtAmount as a
// Prisma Decimal; ones from orderService already carry it as BigInt (see
// withBigIntUsdtAmount there). Normalize on the way in so every path out
// of this function agrees on the type.
function normalizeUsdtAmount(order) {
  if (typeof order.usdtAmount === 'bigint') return order;
  return { ...order, usdtAmount: decimalToBigInt(order.usdtAmount) };
}

// There is no scheduled sweep for quote expiry (that's what a queue worker
// is for, and none is warranted yet) — instead, every read or mutation of
// a non-terminal order checks its own deadline first and expires lazily.
// EXPIRED is enforced as terminal by the same DB trigger as everything
// else; this just decides *when* to make the call.
async function expireIfNeeded(prisma, orderInput) {
  const order = normalizeUsdtAmount(orderInput);

  if (!EXPIRABLE_STATUSES.has(order.status) || order.quoteExpiresAt > new Date()) {
    return order;
  }

  try {
    return await transitionOrder(prisma, {
      orderId: order.id,
      toStatus: 'EXPIRED',
      actorType: 'SYSTEM',
      actor: 'system',
      note: 'quote TTL elapsed',
    });
  } catch (err) {
    if (err instanceof IllegalTransitionError) {
      // Order moved on (e.g. payment was claimed) before this check ran —
      // return whatever is actually current instead of a stale read.
      const current = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
      return normalizeUsdtAmount(current);
    }
    throw err;
  }
}

module.exports = { expireIfNeeded };
