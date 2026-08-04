const request = require('supertest');
const { prisma, resetDb, seedPlatformSettings } = require('./testDb');
const { buildTestApp } = require('./testApp');

jest.setTimeout(30000);

const TRON_ADDRESS = 'TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE';
const BSC_ADDRESS = '0x9F3c2e7a1B4D8C6F0A2e5D9B3C7f1A4e8D2B6c0f';
const TRON_USDT_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';

beforeAll(async () => {
  await seedPlatformSettings();
});

afterEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('GET /api/quotes/market', () => {
  test('returns the market rate with no address needed', async () => {
    const app = buildTestApp();
    const res = await request(app).get('/api/quotes/market');
    expect(res.status).toBe(200);
    expect(res.body.marketRateMicros).toBe('650000000');
    expect(res.body.tronNetworkFeeXaf).toBe(500);
    expect(res.body.bscNetworkFeeXaf).toBe(200);
  });

  test('fails closed when no rate is configured', async () => {
    await prisma.platformSettings.deleteMany({ where: { id: 'default' } });
    try {
      const app = buildTestApp();
      const res = await request(app).get('/api/quotes/market');
      expect(res.status).toBe(503);
    } finally {
      await seedPlatformSettings();
    }
  });
});

describe('POST /api/quotes/preview', () => {
  test('returns a live quote for a valid address and amount', async () => {
    const app = buildTestApp();
    const res = await request(app)
      .post('/api/quotes/preview')
      .send({ xafAmount: 32500, destinationAddress: TRON_ADDRESS });

    expect(res.status).toBe(200);
    expect(res.body.addressValid).toBe(true);
    expect(res.body.chain).toBe('TRON');
    expect(res.body.rate.networkFeeXaf).toBe(500);
    expect(res.body.usdtAmount).toBeDefined();
    expect(res.body.amountError).toBeNull();
  });

  test('address valid but no amount yet: rate is available, usdtAmount is not', async () => {
    const app = buildTestApp();
    const res = await request(app)
      .post('/api/quotes/preview')
      .send({ destinationAddress: TRON_ADDRESS });

    expect(res.status).toBe(200);
    expect(res.body.addressValid).toBe(true);
    expect(res.body.rate.networkFeeXaf).toBe(500);
    expect(res.body.usdtAmount).toBeNull();
    expect(res.body.amountError).toMatch(/amount/i);
  });

  test('reports an address-in-progress state instead of erroring on empty input', async () => {
    const app = buildTestApp();
    const res = await request(app).post('/api/quotes/preview').send({ xafAmount: 32500, destinationAddress: '' });

    expect(res.status).toBe(200);
    expect(res.body.addressValid).toBe(false);
    expect(res.body.usdtAmount).toBeUndefined();
  });

  test('flags that BSC needs explicit confirmation', async () => {
    const app = buildTestApp();
    const res = await request(app)
      .post('/api/quotes/preview')
      .send({ xafAmount: 32500, destinationAddress: BSC_ADDRESS });

    expect(res.status).toBe(200);
    expect(res.body.requiresBscConfirmation).toBe(true);
  });
});

describe('POST /api/orders (create)', () => {
  test('creates an order already in AWAITING_PAYMENT with payment instructions', async () => {
    const app = buildTestApp();
    const res = await request(app)
      .post('/api/orders')
      .send({ xafAmount: 32500, destinationAddress: TRON_ADDRESS });

    expect(res.status).toBe(201);
    expect(res.body.order.status).toBe('AWAITING_PAYMENT');
    expect(res.body.order.reference).toMatch(/^CXF-/);
    expect(typeof res.body.order.usdtAmount).toBe('string');
    expect(res.body.payment).toEqual({
      momoNetwork: 'MTN',
      momoNumber: '677000000',
      momoAccountName: 'Test Account',
    });

    const logs = await prisma.orderAuditLog.findMany({
      where: { order: { reference: res.body.order.reference } },
      orderBy: { createdAt: 'asc' },
    });
    expect(logs.map((l) => l.toStatus)).toEqual(['QUOTED', 'AWAITING_PAYMENT']);
  });

  test('rejects a BSC destination without explicit confirmation', async () => {
    const app = buildTestApp();
    const res = await request(app).post('/api/orders').send({ xafAmount: 32500, destinationAddress: BSC_ADDRESS });
    expect(res.status).toBe(400);
  });

  test('accepts a BSC destination once confirmed', async () => {
    const app = buildTestApp();
    const res = await request(app)
      .post('/api/orders')
      .send({ xafAmount: 32500, destinationAddress: BSC_ADDRESS, bscConfirmed: true });
    expect(res.status).toBe(201);
    expect(res.body.order.chain).toBe('BSC');
  });

  test('rejects a known USDT contract address', async () => {
    const app = buildTestApp();
    const res = await request(app)
      .post('/api/orders')
      .send({ xafAmount: 32500, destinationAddress: TRON_USDT_CONTRACT });
    expect(res.status).toBe(400);
  });

  test('rejects an amount too small to cover the network fee', async () => {
    const app = buildTestApp();
    const res = await request(app).post('/api/orders').send({ xafAmount: 10, destinationAddress: TRON_ADDRESS });
    expect(res.status).toBe(400);
  });

  test('fails closed when no rate is configured', async () => {
    await prisma.platformSettings.deleteMany({ where: { id: 'default' } });
    try {
      const app = buildTestApp();
      const res = await request(app)
        .post('/api/orders')
        .send({ xafAmount: 32500, destinationAddress: TRON_ADDRESS });
      expect(res.status).toBe(503);
    } finally {
      await seedPlatformSettings(); // restore for subsequent tests regardless of outcome
    }
  });
});

describe('order lifecycle: claim payment and status', () => {
  async function createTestOrder(app) {
    const res = await request(app).post('/api/orders').send({ xafAmount: 32500, destinationAddress: TRON_ADDRESS });
    return res.body.order.reference;
  }

  test('GET unknown reference returns 404', async () => {
    const app = buildTestApp();
    const res = await request(app).get('/api/orders/NOPE-0000');
    expect(res.status).toBe(404);
  });

  test('claim-payment moves AWAITING_PAYMENT -> PAYMENT_CLAIMED and status reflects it', async () => {
    const app = buildTestApp();
    const reference = await createTestOrder(app);

    const claim = await request(app)
      .post(`/api/orders/${reference}/claim-payment`)
      .send({ momoTxId: 'MP240731.4471.882610', customerMomoNumber: '+237677123456' });

    expect(claim.status).toBe(200);
    expect(claim.body.order.status).toBe('PAYMENT_CLAIMED');
    expect(claim.body.order.paymentReference).toBe('MP240731.4471.882610');

    const status = await request(app).get(`/api/orders/${reference}`);
    expect(status.status).toBe(200);
    expect(status.body.order.status).toBe('PAYMENT_CLAIMED');
    expect(status.body.order.rateSnapshot.networkFeeXaf).toBe(500);
  });

  test('claim-payment requires both fields', async () => {
    const app = buildTestApp();
    const reference = await createTestOrder(app);
    const res = await request(app).post(`/api/orders/${reference}/claim-payment`).send({ momoTxId: 'x' });
    expect(res.status).toBe(400);
  });

  test('claim-payment on an unknown reference returns 404', async () => {
    const app = buildTestApp();
    const res = await request(app)
      .post('/api/orders/NOPE-0000/claim-payment')
      .send({ momoTxId: 'x', customerMomoNumber: '+237600000000' });
    expect(res.status).toBe(404);
  });

  test('a lapsed quote expires lazily on read, and can no longer be claimed', async () => {
    const app = buildTestApp();
    const reference = await createTestOrder(app);

    // A plain Prisma update, not raw SQL `now()`: the DB session's
    // TimeZone (non-UTC here) makes a raw `now()` written into a
    // timezone-naive column round-trip wrong relative to Node's clock.
    // A genuine JS Date passed through Prisma's own parameter handling
    // doesn't have that problem.
    await prisma.order.update({
      where: { reference },
      data: { quoteExpiresAt: new Date(Date.now() - 60_000) },
    });

    const status = await request(app).get(`/api/orders/${reference}`);
    expect(status.body.order.status).toBe('EXPIRED');

    const claim = await request(app)
      .post(`/api/orders/${reference}/claim-payment`)
      .send({ momoTxId: 'x', customerMomoNumber: '+237600000000' });
    expect(claim.status).toBe(409);
  });
});
