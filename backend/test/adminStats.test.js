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

describe('GET /api/admin/stats', () => {
  test('returns 401 without a session', async () => {
    const app = buildTestApp();
    const res = await request(app).get('/api/admin/stats');
    expect(res.status).toBe(401);
  });

  test('buckets completed orders by direction into today, excludes non-completed', async () => {
    const app = buildTestApp();
    const { agent } = await loginAgent(app);

    const buy1 = await createOrderAt('COMPLETED', { direction: 'BUY' });
    const buy2 = await createOrderAt('COMPLETED', { direction: 'BUY' });
    const sell1 = await createOrderAt('COMPLETED', { direction: 'SELL', chain: 'TRON' });
    await createOrderAt('AWAITING_PAYMENT'); // not completed — excluded

    const res = await agent.get('/api/admin/stats').query({ days: 7 });

    expect(res.status).toBe(200);
    expect(res.body.days.length).toBe(7);
    const today = res.body.days[res.body.days.length - 1];
    expect(today.buyCount).toBe(2);
    expect(today.sellCount).toBe(1);
    expect(today.buyXaf).toBe(buy1.xafAmount + buy2.xafAmount);
    expect(today.sellXaf).toBe(sell1.xafAmount);
    expect(res.body.totals.buyCount).toBe(2);
    expect(res.body.totals.sellCount).toBe(1);
  });

  test('fills days with no activity as zero, not omitted', async () => {
    const app = buildTestApp();
    const { agent } = await loginAgent(app);

    const res = await agent.get('/api/admin/stats').query({ days: 5 });

    expect(res.status).toBe(200);
    expect(res.body.days.length).toBe(5);
    expect(res.body.days.every((d) => d.buyCount === 0 && d.sellCount === 0)).toBe(true);
  });

  test('clamps an out-of-range days param instead of erroring', async () => {
    const app = buildTestApp();
    const { agent } = await loginAgent(app);

    const tooMany = await agent.get('/api/admin/stats').query({ days: 9000 });
    expect(tooMany.status).toBe(200);
    expect(tooMany.body.days.length).toBe(90);

    const junk = await agent.get('/api/admin/stats').query({ days: 'not-a-number' });
    expect(junk.status).toBe(200);
    expect(junk.body.days.length).toBe(30);
  });
});
