const request = require('supertest');
const { prisma, resetDb, createTestOperator, createOrderAt, seedPlatformSettings } = require('./testDb');
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

const validPayload = {
  xafUsdtRate: '650.5',
  tronNetworkFeeXaf: 450,
  bscNetworkFeeXaf: 120,
  targetMarginPct: 2.9,
  rateTtlSeconds: 86400,
  momoNetwork: 'MTN',
  momoNumber: '677123456',
  momoAccountName: 'CryptoXAF Operator',
};

describe('admin settings routes require authentication', () => {
  test.each([
    ['get', '/api/admin/settings'],
    ['put', '/api/admin/settings'],
  ])('%s %s returns 401 without a session', async (method, path) => {
    const app = buildTestApp();
    const res = await request(app)[method](path);
    expect(res.status).toBe(401);
  });
});

describe('GET /api/admin/settings', () => {
  test('returns null when the settings row has never been seeded', async () => {
    const app = buildTestApp();
    const { agent } = await loginAgent(app);
    await prisma.platformSettings.deleteMany({ where: { id: 'default' } });

    const res = await agent.get('/api/admin/settings');

    expect(res.status).toBe(200);
    expect(res.body.settings).toBeNull();
    // The safety-rail range is available even pre-seed, so the form can
    // still render a preview before the very first save.
    expect(res.body.marginClampRangePct).toEqual({ min: 0.5, max: 10 });
  });

  test('returns the effective (clamped) margin alongside the stored margin', async () => {
    const app = buildTestApp();
    const { agent } = await loginAgent(app);
    await seedPlatformSettings({ targetMarginBps: 150 });

    const res = await agent.get('/api/admin/settings');

    expect(res.status).toBe(200);
    expect(res.body.settings.targetMarginPct).toBe(1.5);
    expect(res.body.settings.effectiveMarginPct).toBe(1.5);
    expect(res.body.settings.xafUsdtRate).toBe('650.000000');
  });
});

describe('PUT /api/admin/settings', () => {
  test('rejects a malformed payload with 400', async () => {
    const app = buildTestApp();
    const { agent } = await loginAgent(app);

    const res = await agent.put('/api/admin/settings').send({ ...validPayload, momoNetwork: 'VODAFONE' });
    expect(res.status).toBe(400);
  });

  test('creates the row on first save and writes an audit log entry', async () => {
    const app = buildTestApp();
    const { agent, operator } = await loginAgent(app);
    await prisma.platformSettings.deleteMany({ where: { id: 'default' } });

    const res = await agent.put('/api/admin/settings').send(validPayload);

    expect(res.status).toBe(200);
    expect(res.body.settings.xafUsdtRate).toBe('650.500000');
    expect(res.body.settings.updatedBy).toBe(`operator:${operator.id}`);

    const stored = await prisma.platformSettings.findUnique({ where: { id: 'default' } });
    expect(stored.momoNumber).toBe('677123456');

    const log = await prisma.adminAuditLog.findFirst({ where: { action: 'settings.update' } });
    expect(log.actor).toBe(`operator:${operator.id}`);
    expect(log.metadata.before).toBeNull();
    expect(log.metadata.after.momoAccountName).toBe('CryptoXAF Operator');
  });

  test('updates an existing row and does not reject a margin outside the safety rail', async () => {
    const app = buildTestApp();
    const { agent } = await loginAgent(app);
    await seedPlatformSettings();

    const res = await agent.put('/api/admin/settings').send({ ...validPayload, targetMarginPct: 25 });

    expect(res.status).toBe(200);
    expect(res.body.settings.targetMarginPct).toBe(25);
    // MAX_MARGIN_BPS is 1000 (10%) — the stored value is honored, but the
    // preview shows what will actually be quoted.
    expect(res.body.settings.effectiveMarginPct).toBe(10);
  });
});

describe('getTodayStats USDT normalization', () => {
  test('sums TRON (6dp) and BSC (18dp) completed orders on a common 6dp scale', async () => {
    const app = buildTestApp();
    const { agent } = await loginAgent(app);
    await seedPlatformSettings();

    await createOrderAt('COMPLETED', { chain: 'TRON', xafAmount: 10_000 });
    await createOrderAt('COMPLETED', { chain: 'BSC', xafAmount: 10_000 });

    const res = await agent.get('/api/admin/orders');

    expect(res.status).toBe(200);
    // Both fixture orders quote to the same 15 USDT (see testDb.js's
    // orderInput default) — a decimals bug would make the BSC leg's
    // contribution ~1e12x too small or too large depending on direction.
    expect(res.body.todayStats.usdtSentMicros).toBe('30000000');
  });
});
