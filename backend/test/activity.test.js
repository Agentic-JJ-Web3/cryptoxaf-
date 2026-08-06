const request = require('supertest');
const { prisma, resetDb, createOrderAt } = require('./testDb');
const { buildTestApp } = require('./testApp');
const { transitionOrder } = require('../src/orders/orderService');

afterEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('GET /api/activity', () => {
  test('is empty when there is no recent completed order', async () => {
    const app = buildTestApp();
    const res = await request(app).get('/api/activity');
    expect(res.status).toBe(200);
    expect(res.body.activity).toEqual([]);
  });

  test('only includes COMPLETED orders, and buckets the amount rather than exposing the exact figure', async () => {
    const app = buildTestApp();
    // xafAmount 10_000 rounds cleanly to a 5,000 bucket either way, so use
    // an amount that doesn't, to prove bucketing actually happened.
    await createOrderAt('COMPLETED', { xafAmount: 32_500 });
    await createOrderAt('PAYMENT_VERIFIED', { xafAmount: 40_000 }); // not completed — must not appear

    const res = await request(app).get('/api/activity');

    expect(res.status).toBe(200);
    expect(res.body.activity).toHaveLength(1);
    const entry = res.body.activity[0];
    expect(entry.roundedXaf).not.toBe(32_500);
    expect(entry.roundedXaf % 5_000).toBe(0);
    expect(['TRON', 'BSC']).toContain(entry.chain);
    expect(typeof entry.minutesAgo).toBe('number');
    expect(entry).not.toHaveProperty('reference');
    expect(entry).not.toHaveProperty('destinationAddress');
  });

  test('excludes a COMPLETED order outside the 24h window', async () => {
    const app = buildTestApp();
    // Once terminal, the row accepts no further UPDATE at all (DB trigger)
    // — so the old timestamp has to be set explicitly on the transition
    // *into* COMPLETED, not backdated afterward.
    const order = await createOrderAt('PAYMENT_VERIFIED');
    await transitionOrder(prisma, {
      orderId: order.id,
      toStatus: 'COMPLETED',
      actorType: 'OPERATOR',
      actor: 'operator:fixture',
      note: 'USDT sent',
      data: { payoutReference: `0xold-${order.id}`, updatedAt: new Date(Date.now() - 25 * 60 * 60 * 1000) },
    });

    const res = await request(app).get('/api/activity');
    expect(res.body.activity).toEqual([]);
  });
});
