const request = require('supertest');
const { prisma, resetDb, createTestOperator, createOrderAt, seedPlatformSettings } = require('./testDb');
const { buildTestApp } = require('./testApp');

const sellSettings = {
  sellMarginBps: 150,
  sellDepositAddressTron: 'TLa2f6VPqDgRE67v1736s7bJ8Ray5wYjU7',
  sellDepositAddressBsc: '0x1111111111111111111111111111111111111a',
};

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

describe('admin sell-order routes require authentication', () => {
  test.each([
    ['post', '/api/admin/orders/SOME-REF/check-deposit'],
    ['post', '/api/admin/orders/SOME-REF/verify-deposit'],
    ['post', '/api/admin/orders/SOME-REF/reject-deposit'],
    ['post', '/api/admin/orders/SOME-REF/complete-sell'],
    ['get', '/api/admin/orders/SOME-REF/receipt'],
  ])('%s %s returns 401 without a session', async (method, path) => {
    const app = buildTestApp();
    const res = await request(app)[method](path);
    expect(res.status).toBe(401);
  });
});

describe('GET /api/admin/orders (queue) — sell orders', () => {
  test('sell orders appear in the default queue alongside buy orders', async () => {
    const app = buildTestApp();
    const { agent } = await loginAgent(app);

    const claimed = await createOrderAt('DEPOSIT_CLAIMED', { direction: 'SELL', chain: 'TRON' });

    const res = await agent.get('/api/admin/orders');

    expect(res.status).toBe(200);
    const references = res.body.orders.map((o) => o.reference);
    expect(references).toContain(claimed.reference);
    expect(res.body.actionCount).toBeGreaterThanOrEqual(1);
  });
});

describe('POST /api/admin/orders/:reference/check-deposit', () => {
  test('rejects when the order has no submitted tx hash', async () => {
    const app = buildTestApp();
    const { agent } = await loginAgent(app);
    const order = await createOrderAt('AWAITING_DEPOSIT', { direction: 'SELL', chain: 'TRON' });

    const res = await agent.post(`/api/admin/orders/${order.reference}/check-deposit`);
    expect(res.status).toBe(400);
  });

  test('reports not-found for a nonexistent tx hash without transitioning the order', async () => {
    const app = buildTestApp();
    const { agent } = await loginAgent(app);
    await seedPlatformSettings(sellSettings);
    const order = await createOrderAt('DEPOSIT_CLAIMED', { direction: 'SELL', chain: 'TRON' });

    const res = await agent.post(`/api/admin/orders/${order.reference}/check-deposit`);

    expect(res.status).toBe(200);
    expect(res.body.found).toBe(false);
    expect(res.body.matches).toBe(false);

    const stored = await prisma.order.findUnique({ where: { reference: order.reference } });
    expect(stored.status).toBe('DEPOSIT_CLAIMED'); // read-only — unchanged
  }, 15000);
});

describe('POST /api/admin/orders/:reference/verify-deposit and /reject-deposit', () => {
  test('verify-deposit moves DEPOSIT_CLAIMED -> DEPOSIT_VERIFIED', async () => {
    const app = buildTestApp();
    const { agent } = await loginAgent(app);
    const order = await createOrderAt('DEPOSIT_CLAIMED', { direction: 'SELL', chain: 'TRON' });

    const res = await agent.post(`/api/admin/orders/${order.reference}/verify-deposit`);

    expect(res.status).toBe(200);
    expect(res.body.order.status).toBe('DEPOSIT_VERIFIED');
  });

  test('reject-deposit moves DEPOSIT_CLAIMED -> REFUND_DUE with a reason', async () => {
    const app = buildTestApp();
    const { agent } = await loginAgent(app);
    const order = await createOrderAt('DEPOSIT_CLAIMED', { direction: 'SELL', chain: 'TRON' });

    const res = await agent.post(`/api/admin/orders/${order.reference}/reject-deposit`).send({ reason: 'amount too low' });

    expect(res.status).toBe(200);
    expect(res.body.order.status).toBe('REFUND_DUE');
    expect(res.body.order.refundReason).toBe('amount too low');
  });
});

describe('POST /api/admin/orders/:reference/complete-sell', () => {
  test('requires a payoutReference and moves the order to COMPLETED', async () => {
    const app = buildTestApp();
    const { agent } = await loginAgent(app);
    const order = await createOrderAt('DEPOSIT_VERIFIED', { direction: 'SELL', chain: 'TRON' });

    const missing = await agent.post(`/api/admin/orders/${order.reference}/complete-sell`).send({});
    expect(missing.status).toBe(400);

    const res = await agent
      .post(`/api/admin/orders/${order.reference}/complete-sell`)
      .send({ payoutReference: 'MOMO-CONF-12345' });

    expect(res.status).toBe(200);
    expect(res.body.order.status).toBe('COMPLETED');
    expect(res.body.order.payoutReference).toBe('MOMO-CONF-12345');
  });

  test('a second complete-sell attempt is rejected — terminal state', async () => {
    const app = buildTestApp();
    const { agent } = await loginAgent(app);
    const order = await createOrderAt('COMPLETED', { direction: 'SELL', chain: 'TRON' });

    const res = await agent
      .post(`/api/admin/orders/${order.reference}/complete-sell`)
      .send({ payoutReference: 'MOMO-CONF-SECOND' });

    expect(res.status).toBe(409);
  });
});

describe('GET /api/admin/orders/:reference/receipt', () => {
  test('404s when the order has no receipt image', async () => {
    const app = buildTestApp();
    const { agent } = await loginAgent(app);
    const order = await createOrderAt('DEPOSIT_CLAIMED', { direction: 'SELL', chain: 'TRON' });

    const res = await agent.get(`/api/admin/orders/${order.reference}/receipt`);
    expect(res.status).toBe(404);
  });

  test('streams the stored image once one was claimed with a screenshot', async () => {
    const app = buildTestApp();
    const { agent } = await loginAgent(app);
    const order = await createOrderAt('AWAITING_DEPOSIT', { direction: 'SELL', chain: 'TRON' });

    await request(app)
      .post(`/api/orders/${order.reference}/claim-deposit`)
      .attach('receipt', Buffer.from([0xff, 0xd8, 0xff, 0xdb]), { filename: 'r.jpg', contentType: 'image/jpeg' });

    const res = await agent.get(`/api/admin/orders/${order.reference}/receipt`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/image\/jpeg/);
  });
});
