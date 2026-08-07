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

describe('GET /api/admin/summary', () => {
  test('returns 401 without a session', async () => {
    const app = buildTestApp();
    const res = await request(app).get('/api/admin/summary');
    expect(res.status).toBe(401);
  });

  test('counts actionable orders, pending reviews, and pending notify requests', async () => {
    const app = buildTestApp();
    const { agent } = await loginAgent(app);

    await createOrderAt('PAYMENT_CLAIMED'); // actionable
    await createOrderAt('AWAITING_PAYMENT'); // not actionable — waiting on customer
    const reviewOrder = await createOrderAt('COMPLETED');
    await prisma.review.create({ data: { orderId: reviewOrder.id, rating: 5, status: 'PENDING' } });
    await prisma.notifyRequest.create({ data: { phone: '677000000' } });
    await prisma.notifyRequest.create({ data: { phone: '677000001', notifiedAt: new Date() } });

    const res = await agent.get('/api/admin/summary');

    expect(res.status).toBe(200);
    expect(res.body.actionableOrders).toBe(1);
    expect(res.body.pendingReviews).toBe(1);
    expect(res.body.pendingNotifyRequests).toBe(1);
  });
});
