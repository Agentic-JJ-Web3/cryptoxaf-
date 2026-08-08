// Isolated in its own file: mocking src/config/hours affects this file's
// whole module registry, so it must not share a registry with tests that
// need the real clock.
jest.mock('../src/config/hours', () => ({
  isOpenNow: jest.fn(),
  reopenLabel: jest.fn(() => 'tomorrow at 7:00am'),
  loadHoursConfig: jest.fn(async () => ({ openHour: 7, closeHour: 21, openWeekdays: [1, 2, 3, 4, 5, 6] })),
}));

const request = require('supertest');
const { isOpenNow } = require('../src/config/hours');
const { prisma, resetDb, seedPlatformSettings } = require('./testDb');
const { buildTestApp } = require('./testApp');

const TRON_ADDRESS = 'TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE';

beforeAll(async () => {
  await seedPlatformSettings();
});

afterEach(async () => {
  await resetDb();
  jest.clearAllMocks();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('order creation while the platform is closed', () => {
  test('rejects with 403 and the reopen time, before touching pricing or address validation', async () => {
    isOpenNow.mockReturnValue(false);
    const app = buildTestApp();

    const res = await request(app)
      .post('/api/orders')
      .send({ xafAmount: 32500, destinationAddress: TRON_ADDRESS });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/tomorrow at 7:00am/);

    const orders = await prisma.order.findMany();
    expect(orders).toHaveLength(0);
  });

  test('allows order creation when open', async () => {
    isOpenNow.mockReturnValue(true);
    const app = buildTestApp();

    const res = await request(app)
      .post('/api/orders')
      .send({ xafAmount: 32500, destinationAddress: TRON_ADDRESS });

    expect(res.status).toBe(201);
  });
});
