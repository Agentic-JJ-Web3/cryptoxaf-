const request = require('supertest');
const { prisma, resetDb, createOrderAt } = require('./testDb');
const { buildTestApp } = require('./testApp');

afterEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('POST /api/orders/:reference/review', () => {
  test('rejects a review on a non-COMPLETED order', async () => {
    const app = buildTestApp();
    const order = await createOrderAt('PAYMENT_VERIFIED');

    const res = await request(app)
      .post(`/api/orders/${order.reference}/review`)
      .send({ rating: 5, comment: 'Great!' });

    expect(res.status).toBe(400);
  });

  test('rejects an out-of-range rating', async () => {
    const app = buildTestApp();
    const order = await createOrderAt('COMPLETED');

    const res = await request(app).post(`/api/orders/${order.reference}/review`).send({ rating: 6 });
    expect(res.status).toBe(400);
  });

  test('accepts a review on a COMPLETED order, held as PENDING', async () => {
    const app = buildTestApp();
    const order = await createOrderAt('COMPLETED');

    const res = await request(app)
      .post(`/api/orders/${order.reference}/review`)
      .send({ rating: 5, comment: 'Fast and easy.' });

    expect(res.status).toBe(201);

    const review = await prisma.review.findUnique({ where: { orderId: order.id } });
    expect(review.status).toBe('PENDING');
    expect(review.rating).toBe(5);

    const statusRes = await request(app).get(`/api/orders/${order.reference}`);
    expect(statusRes.body.order.hasReview).toBe(true);
  });

  test('a second review on the same order is rejected with 409', async () => {
    const app = buildTestApp();
    const order = await createOrderAt('COMPLETED');

    const first = await request(app).post(`/api/orders/${order.reference}/review`).send({ rating: 4 });
    expect(first.status).toBe(201);

    const second = await request(app).post(`/api/orders/${order.reference}/review`).send({ rating: 2 });
    expect(second.status).toBe(409);
  });

  test('a PENDING review never appears in the public reviews list', async () => {
    const app = buildTestApp();
    const order = await createOrderAt('COMPLETED');
    await request(app).post(`/api/orders/${order.reference}/review`).send({ rating: 5, comment: 'hidden' });

    const res = await request(app).get('/api/reviews');
    expect(res.status).toBe(200);
    expect(res.body.reviews.find((r) => r.comment === 'hidden')).toBeUndefined();
  });
});

describe('GET /api/reviews (public)', () => {
  test('only returns APPROVED reviews, never the order reference', async () => {
    const app = buildTestApp();
    const order = await createOrderAt('COMPLETED');
    await prisma.review.create({
      data: { orderId: order.id, rating: 5, comment: 'Loved it', status: 'APPROVED' },
    });

    const res = await request(app).get('/api/reviews');

    expect(res.status).toBe(200);
    expect(res.body.reviews).toHaveLength(1);
    expect(res.body.reviews[0]).toEqual({
      id: expect.any(String),
      rating: 5,
      comment: 'Loved it',
      chain: order.chain,
      createdAt: expect.any(String),
    });
    expect(res.body.reviews[0].orderId).toBeUndefined();
    expect(res.body.reviews[0].reference).toBeUndefined();
  });
});
