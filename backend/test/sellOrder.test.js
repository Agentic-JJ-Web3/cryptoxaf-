// These tests exercise sell-order creation logic, not open/closed gating
// (that's covered for buy in platformClosed.test.js) — mocked open so
// results don't depend on what time it happens to be when the suite runs.
jest.mock('../src/config/hours', () => ({
  isOpenNow: jest.fn(() => true),
  reopenLabel: jest.fn(() => 'tomorrow at 7:00am'),
  loadHoursConfig: jest.fn(async () => ({ openHour: 7, closeHour: 21, openWeekdays: [1, 2, 3, 4, 5, 6] })),
}));

const request = require('supertest');
const { prisma, resetDb, seedPlatformSettings, createOrderAt } = require('./testDb');
const { buildTestApp } = require('./testApp');

const TRON_ADDRESS = 'TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE';
const BSC_ADDRESS = '0x9F3c2e7a1B4D8C6F0A2e5D9B3C7f1A4e8D2B6c0f';

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

describe('POST /api/orders/sell', () => {
  test('fails closed when sell is not configured', async () => {
    const app = buildTestApp();
    await seedPlatformSettings({ sellMarginBps: null, sellDepositAddressTron: null, sellDepositAddressBsc: null });

    const res = await request(app).post('/api/orders/sell').send({
      usdtAmount: '50',
      chain: 'TRON',
      destinationAddress: TRON_ADDRESS,
      customerMomoNumber: '677000000',
      customerMomoNetwork: 'MTN',
    });

    expect(res.status).toBe(503);
  });

  test('rejects a refund-safety-net address on the wrong chain', async () => {
    const app = buildTestApp();
    await seedPlatformSettings(sellSettings);

    const res = await request(app).post('/api/orders/sell').send({
      usdtAmount: '50',
      chain: 'TRON',
      destinationAddress: BSC_ADDRESS, // wrong chain for a TRON sell
      customerMomoNumber: '677000000',
      customerMomoNetwork: 'MTN',
    });

    expect(res.status).toBe(400);
  }, 15000);

  test('creates a sell order in AWAITING_DEPOSIT with deposit instructions', async () => {
    const app = buildTestApp();
    await seedPlatformSettings(sellSettings);

    const res = await request(app).post('/api/orders/sell').send({
      usdtAmount: '50',
      chain: 'TRON',
      destinationAddress: TRON_ADDRESS,
      customerMomoNumber: '677000000',
      customerMomoNetwork: 'MTN',
    });

    expect(res.status).toBe(201);
    expect(res.body.order.status).toBe('AWAITING_DEPOSIT');
    expect(res.body.order.direction).toBe('SELL');
    expect(res.body.deposit.depositAddress).toBe(sellSettings.sellDepositAddressTron);
  }, 15000);

  test('rejects a missing MoMo network with 400', async () => {
    const app = buildTestApp();
    await seedPlatformSettings(sellSettings);

    const res = await request(app).post('/api/orders/sell').send({
      usdtAmount: '50',
      chain: 'TRON',
      destinationAddress: TRON_ADDRESS,
      customerMomoNumber: '677000000',
    });

    expect(res.status).toBe(400);
  });
});

describe('GET /api/orders/:reference — sell', () => {
  test('surfaces deposit instructions while AWAITING_DEPOSIT', async () => {
    const app = buildTestApp();
    await seedPlatformSettings(sellSettings);
    const order = await createOrderAt('AWAITING_DEPOSIT', { direction: 'SELL', chain: 'TRON' });

    const res = await request(app).get(`/api/orders/${order.reference}`);

    expect(res.status).toBe(200);
    expect(res.body.deposit.depositAddress).toBe(sellSettings.sellDepositAddressTron);
    expect(res.body.order.explorerTxUrl).toBeNull(); // never a tx-hash link for sell
  });

  test('deposit instructions are null once sell is turned off, without breaking the page', async () => {
    const app = buildTestApp();
    await seedPlatformSettings(sellSettings);
    const order = await createOrderAt('AWAITING_DEPOSIT', { direction: 'SELL', chain: 'TRON' });
    await seedPlatformSettings({ sellMarginBps: null, sellDepositAddressTron: null, sellDepositAddressBsc: null });

    const res = await request(app).get(`/api/orders/${order.reference}`);

    expect(res.status).toBe(200);
    expect(res.body.deposit).toBeNull();
  });
});

describe('POST /api/orders/:reference/claim-deposit', () => {
  test('requires a tx hash or a screenshot', async () => {
    const app = buildTestApp();
    await seedPlatformSettings(sellSettings);
    const order = await createOrderAt('AWAITING_DEPOSIT', { direction: 'SELL', chain: 'TRON' });

    const res = await request(app).post(`/api/orders/${order.reference}/claim-deposit`).send({});
    expect(res.status).toBe(400);
  });

  test('a tx hash alone moves the order to DEPOSIT_CLAIMED', async () => {
    const app = buildTestApp();
    await seedPlatformSettings(sellSettings);
    const order = await createOrderAt('AWAITING_DEPOSIT', { direction: 'SELL', chain: 'TRON' });

    const res = await request(app)
      .post(`/api/orders/${order.reference}/claim-deposit`)
      .field('txHash', '0xdeadbeef');

    expect(res.status).toBe(200);
    expect(res.body.order.status).toBe('DEPOSIT_CLAIMED');
    expect(res.body.order.paymentReference).toBe('0xdeadbeef');
    expect(res.body.order.depositReceiptImagePath).toBe(false); // never leaks a raw path
  });

  test('a screenshot alone (no tx hash) also moves the order to DEPOSIT_CLAIMED', async () => {
    const app = buildTestApp();
    await seedPlatformSettings(sellSettings);
    const order = await createOrderAt('AWAITING_DEPOSIT', { direction: 'SELL', chain: 'TRON' });

    const res = await request(app)
      .post(`/api/orders/${order.reference}/claim-deposit`)
      .attach('receipt', Buffer.from([0xff, 0xd8, 0xff, 0xdb]), { filename: 'receipt.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(200);
    expect(res.body.order.status).toBe('DEPOSIT_CLAIMED');
    expect(res.body.order.depositReceiptImagePath).toBe(true);
  });

  test('rejects a non-image file', async () => {
    const app = buildTestApp();
    await seedPlatformSettings(sellSettings);
    const order = await createOrderAt('AWAITING_DEPOSIT', { direction: 'SELL', chain: 'TRON' });

    const res = await request(app)
      .post(`/api/orders/${order.reference}/claim-deposit`)
      .attach('receipt', Buffer.from('not an image'), { filename: 'receipt.txt', contentType: 'text/plain' });

    expect(res.status).toBe(400);
  });
});
