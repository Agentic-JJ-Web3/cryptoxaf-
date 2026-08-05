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

async function createReview(overrides = {}) {
  const order = await createOrderAt('COMPLETED');
  const review = await prisma.review.create({
    data: { orderId: order.id, rating: 4, comment: 'Solid', ...overrides },
  });
  return { order, review };
}

describe('admin review routes require authentication', () => {
  test.each([
    ['get', '/api/admin/reviews'],
    ['post', '/api/admin/reviews/some-id/approve'],
    ['post', '/api/admin/reviews/some-id/reject'],
  ])('%s %s returns 401 without a session', async (method, path) => {
    const app = buildTestApp();
    const res = await request(app)[method](path);
    expect(res.status).toBe(401);
  });
});

describe('GET /api/admin/reviews', () => {
  test('defaults to PENDING, includes the order reference for moderation context, and a pending count', async () => {
    const app = buildTestApp();
    const { agent } = await loginAgent(app);
    const { order, review } = await createReview();
    await createReview({ status: 'APPROVED' }); // should not appear in the default PENDING list

    const res = await agent.get('/api/admin/reviews');

    expect(res.status).toBe(200);
    expect(res.body.reviews.map((r) => r.id)).toEqual([review.id]);
    expect(res.body.reviews[0].orderReference).toBe(order.reference);
    expect(res.body.pendingCount).toBe(1);
  });

  test('rejects an invalid status filter', async () => {
    const app = buildTestApp();
    const { agent } = await loginAgent(app);
    const res = await agent.get('/api/admin/reviews?status=NOT_A_STATUS');
    expect(res.status).toBe(400);
  });
});

describe('POST /api/admin/reviews/:id/approve and /reject', () => {
  test('approve makes a review visible on the public endpoint and writes an audit log entry', async () => {
    const app = buildTestApp();
    const { agent, operator } = await loginAgent(app);
    const { review } = await createReview();

    const res = await agent.post(`/api/admin/reviews/${review.id}/approve`);

    expect(res.status).toBe(200);
    expect(res.body.review.status).toBe('APPROVED');

    const publicRes = await request(app).get('/api/reviews');
    expect(publicRes.body.reviews.map((r) => r.id)).toContain(review.id);

    const log = await prisma.adminAuditLog.findFirst({ where: { action: 'review.approve' } });
    expect(log.actor).toBe(`operator:${operator.id}`);
  });

  test('reject never makes a review visible publicly', async () => {
    const app = buildTestApp();
    const { agent } = await loginAgent(app);
    const { review } = await createReview();

    const res = await agent.post(`/api/admin/reviews/${review.id}/reject`);
    expect(res.status).toBe(200);
    expect(res.body.review.status).toBe('REJECTED');

    const publicRes = await request(app).get('/api/reviews');
    expect(publicRes.body.reviews.map((r) => r.id)).not.toContain(review.id);
  });

  test('acting on an already-moderated review returns 404', async () => {
    const app = buildTestApp();
    const { agent } = await loginAgent(app);
    const { review } = await createReview();

    const first = await agent.post(`/api/admin/reviews/${review.id}/approve`);
    expect(first.status).toBe(200);

    const second = await agent.post(`/api/admin/reviews/${review.id}/reject`);
    expect(second.status).toBe(404);
  });

  test('returns 404 for an unknown id', async () => {
    const app = buildTestApp();
    const { agent } = await loginAgent(app);
    const res = await agent.post('/api/admin/reviews/00000000-0000-0000-0000-000000000000/approve');
    expect(res.status).toBe(404);
  });
});
