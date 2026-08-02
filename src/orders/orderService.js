const { isLegalTransition } = require('./stateMachine');

class OrderNotFoundError extends Error {
  constructor(orderId) {
    super(`Order ${orderId} not found`);
    this.name = 'OrderNotFoundError';
  }
}

class IllegalTransitionError extends Error {
  constructor(fromStatus, toStatus) {
    super(`Cannot transition order from ${fromStatus} to ${toStatus}`);
    this.name = 'IllegalTransitionError';
    this.fromStatus = fromStatus;
    this.toStatus = toStatus;
  }
}

// Creates the RateSnapshot and the Order it prices in one transaction, plus
// the audit log entry for the initial QUOTED state, so an order can never
// exist without the pricing inputs it was quoted from.
async function createOrder(prisma, { reference, chain, destinationAddress, xafAmount, usdtAmount, quoteExpiresAt, rateSnapshot }) {
  return prisma.$transaction(async (tx) => {
    const snapshot = await tx.rateSnapshot.create({ data: rateSnapshot });

    const order = await tx.order.create({
      data: {
        reference,
        chain,
        destinationAddress,
        xafAmount,
        usdtAmount,
        quoteExpiresAt,
        rateSnapshotId: snapshot.id,
      },
    });

    await tx.orderAuditLog.create({
      data: {
        orderId: order.id,
        fromStatus: null,
        toStatus: order.status,
        actorType: 'SYSTEM',
        actor: 'system',
        note: 'order created',
      },
    });

    return order;
  });
}

// Moves `orderId` to `toStatus` inside a transaction that row-locks the
// order first (`SELECT ... FOR UPDATE`), so two concurrent callers on the
// same order serialize instead of racing a read-modify-write. The second
// caller reads the *post-commit* status of the first and is rejected by
// the same guard the first was checked against — no double-completion,
// no lost update. `data` carries transition-specific fields (payoutTxHash,
// paymentReference, refundReason, ...).
async function transitionOrder(prisma, { orderId, toStatus, actorType, actor, note, data = {} }) {
  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw`SELECT "status" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;

    if (locked.length === 0) {
      throw new OrderNotFoundError(orderId);
    }

    const fromStatus = locked[0].status;

    if (!isLegalTransition(fromStatus, toStatus)) {
      throw new IllegalTransitionError(fromStatus, toStatus);
    }

    const updated = await tx.order.update({
      where: { id: orderId },
      data: { status: toStatus, ...data },
    });

    await tx.orderAuditLog.create({
      data: {
        orderId,
        fromStatus,
        toStatus,
        actorType,
        actor,
        note,
      },
    });

    return updated;
  });
}

module.exports = { createOrder, transitionOrder, OrderNotFoundError, IllegalTransitionError };
