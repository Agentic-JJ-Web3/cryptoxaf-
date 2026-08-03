const request = require('supertest');
const { prisma, resetDb, createTestOperator, createOrderAt } = require('./testDb');
const { buildTestApp } = require('./testApp');

afterEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function loginAgent(app) {
  const { operator, password } = await createTestOperator({ email: `ops-${Date.now()}@cryptoxaf.local` });
  const agent = request.agent(app);
  await agent.post('/api/admin/auth/login').send({ email: operator.email, password });
  return { agent, operator };
}

describe('admin order routes require authentication', () => {
  test.each([
    ['get', '/api/admin/orders'],
    ['get', '/api/admin/orders/SOME-REF'],
    ['post', '/api/admin/orders/SOME-REF/verify-payment'],
    ['post', '/api/admin/orders/SOME-REF/reject-payment'],
    ['post', '/api/admin/orders/SOME-REF/complete'],
    ['post', '/api/admin/orders/SOME-REF/refund'],
  ])('%s %s returns 401 without a session', async (method, path) => {
    const app = buildTestApp();
    const res = await request(app)[method](path);
    expect(res.status).toBe(401);
  });
});

describe('GET /api/admin/orders (queue)', () => {
  test('lists orders needing attention and counts actionable ones', async () => {
    const app = buildTestApp();
    const { agent } = await loginAgent(app);

    const claimed = await createOrderAt('PAYMENT_CLAIMED');
    const verified = await createOrderAt('PAYMENT_VERIFIED');
    const completed = await createOrderAt('COMPLETED'); // terminal — should not appear in the default queue

    const res = await agent.get('/api/admin/orders');

    expect(res.status).toBe(200);
    const references = res.body.orders.map((o) => o.reference);
    expect(references).toEqual(expect.arrayContaining([claimed.reference, verified.reference]));
    expect(references).not.toContain(completed.reference);
    expect(res.body.actionCount).toBeGreaterThanOrEqual(2);
    expect(typeof res.body.todayStats.ordersSettled).toBe('number');
    // usdtAmount must be JSON-safe (BigInt would throw during serialization).
    expect(typeof res.body.orders[0].usdtAmount).toBe('string');
  });

  test("today's stats count the COMPLETED order created above", async () => {
    const app = buildTestApp();
    const { agent } = await loginAgent(app);
    const completed = await createOrderAt('COMPLETED');

    const res = await agent.get('/api/admin/orders');

    expect(res.body.todayStats.ordersSettled).toBeGreaterThanOrEqual(1);
    expect(res.body.todayStats.xafCollected).toBeGreaterThanOrEqual(completed.xafAmount);
  });
});

describe('GET /api/admin/orders/:reference (detail)', () => {
  test('returns 404 for an unknown reference', async () => {
    const app = buildTestApp();
    const { agent } = await loginAgent(app);
    const res = await agent.get('/api/admin/orders/DOES-NOT-EXIST');
    expect(res.status).toBe(404);
  });

  test('returns the full record including rate snapshot and audit log', async () => {
    const app = buildTestApp();
    const { agent } = await loginAgent(app);
    const order = await createOrderAt('PAYMENT_CLAIMED');

    const res = await agent.get(`/api/admin/orders/${order.reference}`);

    expect(res.status).toBe(200);
    expect(res.body.order.reference).toBe(order.reference);
    expect(res.body.order.customerMomoNumber).toBe('+237600000000');
    expect(res.body.order.rateSnapshot.marketRateMicros).toBe('650000000');
    expect(res.body.order.auditLogs.map((l) => l.toStatus)).toEqual([
      'QUOTED',
      'AWAITING_PAYMENT',
      'PAYMENT_CLAIMED',
    ]);
  });
});

describe('settlement actions', () => {
  test('verify-payment moves PAYMENT_CLAIMED -> PAYMENT_VERIFIED and logs the operator', async () => {
    const app = buildTestApp();
    const { agent, operator } = await loginAgent(app);
    const order = await createOrderAt('PAYMENT_CLAIMED');

    const res = await agent.post(`/api/admin/orders/${order.reference}/verify-payment`);

    expect(res.status).toBe(200);
    expect(res.body.order.status).toBe('PAYMENT_VERIFIED');

    const log = await prisma.orderAuditLog.findFirst({ where: { orderId: order.id, toStatus: 'PAYMENT_VERIFIED' } });
    expect(log.actor).toBe(`operator:${operator.id}`);
  });

  test('verify-payment on a non-claimed order returns 409', async () => {
    const app = buildTestApp();
    const { agent } = await loginAgent(app);
    const order = await createOrderAt('QUOTED');

    const res = await agent.post(`/api/admin/orders/${order.reference}/verify-payment`);
    expect(res.status).toBe(409);
  });

  test('verify-payment on an unknown reference returns 404', async () => {
    const app = buildTestApp();
    const { agent } = await loginAgent(app);
    const res = await agent.post('/api/admin/orders/NOPE/verify-payment');
    expect(res.status).toBe(404);
  });

  test('reject-payment requires a reason and moves order to REFUND_DUE', async () => {
    const app = buildTestApp();
    const { agent } = await loginAgent(app);
    const order = await createOrderAt('PAYMENT_CLAIMED');

    const missingReason = await agent.post(`/api/admin/orders/${order.reference}/reject-payment`).send({});
    expect(missingReason.status).toBe(400);

    const res = await agent
      .post(`/api/admin/orders/${order.reference}/reject-payment`)
      .send({ reason: 'transaction ID does not match any payment received' });

    expect(res.status).toBe(200);
    expect(res.body.order.status).toBe('REFUND_DUE');
    expect(res.body.order.refundReason).toBe('transaction ID does not match any payment received');
  });

  test('complete requires a payoutTxHash and moves order to COMPLETED', async () => {
    const app = buildTestApp();
    const { agent } = await loginAgent(app);
    const order = await createOrderAt('PAYMENT_VERIFIED');

    const missingHash = await agent.post(`/api/admin/orders/${order.reference}/complete`).send({});
    expect(missingHash.status).toBe(400);

    const res = await agent
      .post(`/api/admin/orders/${order.reference}/complete`)
      .send({ payoutTxHash: '0xabc123' });

    expect(res.status).toBe(200);
    expect(res.body.order.status).toBe('COMPLETED');
    expect(res.body.order.payoutTxHash).toBe('0xabc123');

    // Terminal: a second completion attempt must fail, even via the route.
    const second = await agent.post(`/api/admin/orders/${order.reference}/complete`).send({ payoutTxHash: '0xdef456' });
    expect(second.status).toBe(409);
  });

  test('refund moves REFUND_DUE -> REFUNDED', async () => {
    const app = buildTestApp();
    const { agent } = await loginAgent(app);
    const order = await createOrderAt('REFUND_DUE');

    const res = await agent.post(`/api/admin/orders/${order.reference}/refund`).send({ note: 'sent back via MoMo' });

    expect(res.status).toBe(200);
    expect(res.body.order.status).toBe('REFUNDED');
  });
});
