const { decimalToBigInt } = require('../db/money');
const { usdtDecimalsFor } = require('../config/chains');
const { transitionOrder, OrderNotFoundError } = require('../orders/orderService');

const STATS_DECIMALS = 6n;

// What the operator queue shows by default: everything except the fully
// resolved terminal states. AWAITING_PAYMENT/PAYMENT_CLAIMED aren't a
// one-tap action yet, but the queue still lists them (elapsed time is
// exactly what tells an operator a customer is stuck).
const QUEUE_STATUSES = ['AWAITING_PAYMENT', 'PAYMENT_CLAIMED', 'PAYMENT_VERIFIED', 'REFUND_DUE'];

// Statuses where the next step is an unambiguous operator action (verify,
// send, or refund) rather than just waiting on the customer.
const ACTIONABLE_STATUSES = new Set(['PAYMENT_CLAIMED', 'PAYMENT_VERIFIED', 'REFUND_DUE']);

function serializeOrder(order) {
  return { ...order, usdtAmount: decimalToBigInt(order.usdtAmount).toString() };
}

function serializeRateSnapshot(rateSnapshot) {
  return {
    ...rateSnapshot,
    marketRateMicros: rateSnapshot.marketRateMicros.toString(),
    quotedRateMicros: rateSnapshot.quotedRateMicros.toString(),
  };
}

async function getTodayStats(prisma) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const completedToday = await prisma.order.findMany({
    where: { status: 'COMPLETED', updatedAt: { gte: startOfDay } },
    select: { xafAmount: true, usdtAmount: true, chain: true },
  });

  // TRON USDT is 6dp, BSC USDT is 18dp — summing raw base units across
  // chains mixes those scales (the same "trillionth of the intended
  // amount" hazard CLAUDE.md warns about for payouts, here in a display
  // rollup instead). Normalize every order to a common 6dp scale first.
  const usdtSentMicros = completedToday.reduce((sum, o) => {
    const decimals = BigInt(usdtDecimalsFor(o.chain));
    const base = decimalToBigInt(o.usdtAmount);
    const normalized = decimals >= STATS_DECIMALS
      ? base / 10n ** (decimals - STATS_DECIMALS)
      : base * 10n ** (STATS_DECIMALS - decimals);
    return sum + normalized;
  }, 0n);

  return {
    ordersSettled: completedToday.length,
    xafCollected: completedToday.reduce((sum, o) => sum + o.xafAmount, 0),
    usdtSentMicros: usdtSentMicros.toString(),
  };
}

async function listQueue(prisma, { statuses = QUEUE_STATUSES, limit = 50, offset = 0 } = {}) {
  const [orders, todayStats] = await Promise.all([
    prisma.order.findMany({
      where: { status: { in: statuses } },
      orderBy: { createdAt: 'asc' },
      take: limit,
      skip: offset,
    }),
    getTodayStats(prisma),
  ]);

  return {
    orders: orders.map(serializeOrder),
    actionCount: orders.filter((o) => ACTIONABLE_STATUSES.has(o.status)).length,
    totalCount: orders.length,
    todayStats,
  };
}

async function getOrderDetail(prisma, reference) {
  const order = await prisma.order.findUnique({
    where: { reference },
    include: { rateSnapshot: true, auditLogs: { orderBy: { createdAt: 'asc' } } },
  });
  if (!order) return null;

  return {
    ...serializeOrder(order),
    rateSnapshot: serializeRateSnapshot(order.rateSnapshot),
  };
}

async function findByReference(prisma, reference) {
  const order = await prisma.order.findUnique({ where: { reference } });
  if (!order) {
    throw new OrderNotFoundError(reference);
  }
  return order;
}

async function verifyPayment(prisma, { reference, operator }) {
  const order = await findByReference(prisma, reference);
  return transitionOrder(prisma, {
    orderId: order.id,
    toStatus: 'PAYMENT_VERIFIED',
    actorType: 'OPERATOR',
    actor: `operator:${operator.id}`,
    note: 'payment verified against MoMo app',
  });
}

async function rejectPayment(prisma, { reference, operator, reason }) {
  const order = await findByReference(prisma, reference);
  return transitionOrder(prisma, {
    orderId: order.id,
    toStatus: 'REFUND_DUE',
    actorType: 'OPERATOR',
    actor: `operator:${operator.id}`,
    note: reason,
    data: { refundReason: reason },
  });
}

async function completeOrder(prisma, { reference, operator, payoutTxHash }) {
  const order = await findByReference(prisma, reference);
  return transitionOrder(prisma, {
    orderId: order.id,
    toStatus: 'COMPLETED',
    actorType: 'OPERATOR',
    actor: `operator:${operator.id}`,
    note: 'USDT sent',
    data: { payoutTxHash },
  });
}

async function refundOrder(prisma, { reference, operator, note }) {
  const order = await findByReference(prisma, reference);
  return transitionOrder(prisma, {
    orderId: order.id,
    toStatus: 'REFUNDED',
    actorType: 'OPERATOR',
    actor: `operator:${operator.id}`,
    note: note || 'refund sent',
  });
}

module.exports = {
  listQueue,
  getOrderDetail,
  verifyPayment,
  rejectPayment,
  completeOrder,
  refundOrder,
  serializeOrder,
};
