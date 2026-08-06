const { prisma, resetDb, orderInput, createOrderAt } = require('./testDb');
const { createOrder, transitionOrder, IllegalTransitionError } = require('../src/orders/orderService');
const { usdtDecimalsFor } = require('../src/config/chains');

afterEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

const createAt = createOrderAt;

describe('order creation', () => {
  test('creates an order with its rate snapshot and an initial audit log row', async () => {
    const order = await createOrder(prisma, orderInput());

    expect(order.status).toBe('QUOTED');
    expect(typeof order.usdtAmount).toBe('bigint');
    expect(typeof order.xafAmount).toBe('number');

    const logs = await prisma.orderAuditLog.findMany({ where: { orderId: order.id } });
    expect(logs).toHaveLength(1);
    expect(logs[0].fromStatus).toBeNull();
    expect(logs[0].toStatus).toBe('QUOTED');
  });

  test('stores USDT base units using per-chain decimals, not a hardcoded literal', async () => {
    const tronOrder = await createOrder(prisma, orderInput({ chain: 'TRON', usdtAmount: 15_000_000n }));
    const bscOrder = await createOrder(prisma, orderInput({ chain: 'BSC', usdtAmount: 15_000_000_000_000_000_000n }));

    expect(usdtDecimalsFor('TRON')).toBe(6);
    expect(usdtDecimalsFor('BSC')).toBe(18);
    expect(tronOrder.usdtAmount).toBe(15_000_000n); // 15 USDT @ 6dp
    expect(bscOrder.usdtAmount).toBe(15_000_000_000_000_000_000n); // 15 USDT @ 18dp
  });

  test('rejects a non-positive XAF amount at the database level', async () => {
    await expect(createOrder(prisma, orderInput({ xafAmount: 0 }))).rejects.toThrow();
  });
});

describe('legal transitions', () => {
  test('walks the full happy path to COMPLETED, logging every step', async () => {
    const order = await createAt('COMPLETED');

    const final = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(final.status).toBe('COMPLETED');
    expect(final.payoutReference).toBe(`0xhash-${order.id}`);

    const logs = await prisma.orderAuditLog.findMany({
      where: { orderId: order.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(logs.map((l) => l.toStatus)).toEqual([
      'QUOTED',
      'AWAITING_PAYMENT',
      'PAYMENT_CLAIMED',
      'PAYMENT_VERIFIED',
      'COMPLETED',
    ]);
  });

  test('walks the refund path to REFUNDED', async () => {
    const order = await createAt('REFUNDED');
    const final = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(final.status).toBe('REFUNDED');
  });

  test('a quote can expire before payment', async () => {
    const order = await createOrder(prisma, orderInput());
    const expired = await transitionOrder(prisma, {
      orderId: order.id,
      toStatus: 'EXPIRED',
      actorType: 'SYSTEM',
      actor: 'system',
      note: 'quote TTL elapsed',
    });
    expect(expired.status).toBe('EXPIRED');
  });
});

describe('illegal transitions', () => {
  test('rejects skipping states (QUOTED -> PAYMENT_CLAIMED)', async () => {
    const order = await createOrder(prisma, orderInput());
    await expect(
      transitionOrder(prisma, {
        orderId: order.id,
        toStatus: 'PAYMENT_CLAIMED',
        actorType: 'CUSTOMER',
        actor: 'customer',
      }),
    ).rejects.toThrow(IllegalTransitionError);

    const unchanged = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(unchanged.status).toBe('QUOTED');
  });

  test('rejects going backwards (PAYMENT_VERIFIED -> AWAITING_PAYMENT)', async () => {
    const order = await createAt('PAYMENT_VERIFIED');
    await expect(
      transitionOrder(prisma, {
        orderId: order.id,
        toStatus: 'AWAITING_PAYMENT',
        actorType: 'OPERATOR',
        actor: 'operator:test',
      }),
    ).rejects.toThrow(IllegalTransitionError);
  });
});

describe('terminal states are unreachable a second time', () => {
  test('double-completion: a second COMPLETED transition is rejected even sequentially', async () => {
    const order = await createAt('PAYMENT_VERIFIED');

    const first = await transitionOrder(prisma, {
      orderId: order.id,
      toStatus: 'COMPLETED',
      actorType: 'OPERATOR',
      actor: 'operator:1',
      data: { payoutReference: '0xfirst' },
    });
    expect(first.status).toBe('COMPLETED');

    await expect(
      transitionOrder(prisma, {
        orderId: order.id,
        toStatus: 'COMPLETED',
        actorType: 'OPERATOR',
        actor: 'operator:2',
        data: { payoutReference: '0xsecond' },
      }),
    ).rejects.toThrow(IllegalTransitionError);

    const final = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(final.payoutReference).toBe('0xfirst');

    const completedLogs = await prisma.orderAuditLog.findMany({
      where: { orderId: order.id, toStatus: 'COMPLETED' },
    });
    expect(completedLogs).toHaveLength(1);
  });

  test('double-completion: two concurrent double-tap requests race for the same order — exactly one wins', async () => {
    const order = await createAt('PAYMENT_VERIFIED');

    const attempt = (actor, payoutReference) =>
      transitionOrder(prisma, {
        orderId: order.id,
        toStatus: 'COMPLETED',
        actorType: 'OPERATOR',
        actor,
        data: { payoutReference },
      });

    const results = await Promise.allSettled([
      attempt('operator:1', '0xconcurrent-a'),
      attempt('operator:2', '0xconcurrent-b'),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(IllegalTransitionError);

    const final = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(final.status).toBe('COMPLETED');
    expect(['0xconcurrent-a', '0xconcurrent-b']).toContain(final.payoutReference);

    const completedLogs = await prisma.orderAuditLog.findMany({
      where: { orderId: order.id, toStatus: 'COMPLETED' },
    });
    expect(completedLogs).toHaveLength(1);
  });

  test('a terminal order rejects an UPDATE even when it bypasses the service and the app-layer guard entirely', async () => {
    const order = await createAt('COMPLETED');

    await expect(
      prisma.$executeRaw`UPDATE "Order" SET "status" = 'COMPLETED' WHERE "id" = ${order.id}`,
    ).rejects.toThrow(/terminal state/);

    await expect(
      prisma.$executeRaw`UPDATE "Order" SET "refundReason" = 'no-op edit attempt' WHERE "id" = ${order.id}`,
    ).rejects.toThrow(/terminal state/);
  });

  test('EXPIRED and REFUNDED are also frozen', async () => {
    const expiredOrder = await createOrder(prisma, orderInput());
    await transitionOrder(prisma, {
      orderId: expiredOrder.id,
      toStatus: 'EXPIRED',
      actorType: 'SYSTEM',
      actor: 'system',
    });
    await expect(
      transitionOrder(prisma, {
        orderId: expiredOrder.id,
        toStatus: 'AWAITING_PAYMENT',
        actorType: 'CUSTOMER',
        actor: 'customer',
      }),
    ).rejects.toThrow(IllegalTransitionError);

    const refundedOrder = await createAt('REFUNDED');
    await expect(
      prisma.$executeRaw`UPDATE "Order" SET "status" = 'QUOTED' WHERE "id" = ${refundedOrder.id}`,
    ).rejects.toThrow(/terminal state/);
  });
});

describe('concurrent transitions racing from the same non-terminal state', () => {
  test('two operators simultaneously resolve PAYMENT_CLAIMED differently — the row lock serializes them, exactly one wins', async () => {
    const order = await createAt('PAYMENT_CLAIMED');

    const verify = transitionOrder(prisma, {
      orderId: order.id,
      toStatus: 'PAYMENT_VERIFIED',
      actorType: 'OPERATOR',
      actor: 'operator:verifier',
    });
    const refund = transitionOrder(prisma, {
      orderId: order.id,
      toStatus: 'REFUND_DUE',
      actorType: 'OPERATOR',
      actor: 'operator:refunder',
      note: 'payment did not match',
    });

    const results = await Promise.allSettled([verify, refund]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(IllegalTransitionError);

    const final = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(['PAYMENT_VERIFIED', 'REFUND_DUE']).toContain(final.status);

    // Whichever won, only one transition out of PAYMENT_CLAIMED was recorded.
    const logsAfterClaim = await prisma.orderAuditLog.findMany({
      where: { orderId: order.id, fromStatus: 'PAYMENT_CLAIMED' },
    });
    expect(logsAfterClaim).toHaveLength(1);
    expect(logsAfterClaim[0].toStatus).toBe(final.status);
  });
});

describe('audit log is append-only', () => {
  test('rejects UPDATE and DELETE at the database level', async () => {
    const order = await createOrder(prisma, orderInput());
    const [log] = await prisma.orderAuditLog.findMany({ where: { orderId: order.id } });

    await expect(
      prisma.$executeRaw`UPDATE "OrderAuditLog" SET "note" = 'tampered' WHERE "id" = ${log.id}`,
    ).rejects.toThrow(/append-only/);

    await expect(
      prisma.$executeRaw`DELETE FROM "OrderAuditLog" WHERE "id" = ${log.id}`,
    ).rejects.toThrow(/append-only/);
  });
});
