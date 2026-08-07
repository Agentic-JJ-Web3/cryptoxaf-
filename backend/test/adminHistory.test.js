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

describe('GET /api/admin/orders/history', () => {
  test('returns 401 without a session', async () => {
    const app = buildTestApp();
    const res = await request(app).get('/api/admin/orders/history');
    expect(res.status).toBe(401);
  });

  test('includes terminal orders the queue excludes, newest first', async () => {
    const app = buildTestApp();
    const { agent } = await loginAgent(app);

    const completed = await createOrderAt('COMPLETED');
    const expired = await createOrderAt('EXPIRED');
    const active = await createOrderAt('PAYMENT_CLAIMED');

    const res = await agent.get('/api/admin/orders/history');

    expect(res.status).toBe(200);
    const references = res.body.orders.map((o) => o.reference);
    expect(references).toEqual(expect.arrayContaining([completed.reference, expired.reference, active.reference]));
    expect(res.body.totalCount).toBeGreaterThanOrEqual(3);
  });

  test('filters by direction', async () => {
    const app = buildTestApp();
    const { agent } = await loginAgent(app);

    const buy = await createOrderAt('COMPLETED', { direction: 'BUY' });
    const sell = await createOrderAt('COMPLETED', { direction: 'SELL', chain: 'TRON' });

    const res = await agent.get('/api/admin/orders/history').query({ direction: 'SELL' });

    expect(res.status).toBe(200);
    const references = res.body.orders.map((o) => o.reference);
    expect(references).toContain(sell.reference);
    expect(references).not.toContain(buy.reference);
  });

  test('filters by status', async () => {
    const app = buildTestApp();
    const { agent } = await loginAgent(app);

    const completed = await createOrderAt('COMPLETED');
    const expired = await createOrderAt('EXPIRED');

    const res = await agent.get('/api/admin/orders/history').query({ status: 'EXPIRED' });

    expect(res.status).toBe(200);
    const references = res.body.orders.map((o) => o.reference);
    expect(references).toContain(expired.reference);
    expect(references).not.toContain(completed.reference);
  });

  test('filters by date range, ignoring an unparseable date rather than erroring', async () => {
    const app = buildTestApp();
    const { agent } = await loginAgent(app);

    const order = await createOrderAt('COMPLETED');
    const farFuture = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

    const noneInFuture = await agent.get('/api/admin/orders/history').query({ dateFrom: farFuture });
    expect(noneInFuture.status).toBe(200);
    expect(noneInFuture.body.orders.map((o) => o.reference)).not.toContain(order.reference);

    const junkDate = await agent.get('/api/admin/orders/history').query({ dateFrom: 'not-a-date' });
    expect(junkDate.status).toBe(200);
    expect(junkDate.body.orders.map((o) => o.reference)).toContain(order.reference);
  });

  test('paginates with limit/offset', async () => {
    const app = buildTestApp();
    const { agent } = await loginAgent(app);

    await createOrderAt('COMPLETED');
    await createOrderAt('COMPLETED');
    await createOrderAt('COMPLETED');

    const res = await agent.get('/api/admin/orders/history').query({ limit: 2, offset: 0 });

    expect(res.status).toBe(200);
    expect(res.body.orders.length).toBe(2);
    expect(res.body.totalCount).toBeGreaterThanOrEqual(3);
  });
});
