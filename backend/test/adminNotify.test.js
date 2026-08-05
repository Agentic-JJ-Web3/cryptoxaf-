const request = require('supertest');
const { prisma, resetDb, createTestOperator } = require('./testDb');
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

describe('admin notify-request routes require authentication', () => {
  test.each([
    ['get', '/api/admin/notify-requests'],
    ['post', '/api/admin/notify-requests/some-id/mark-notified'],
  ])('%s %s returns 401 without a session', async (method, path) => {
    const app = buildTestApp();
    const res = await request(app)[method](path);
    expect(res.status).toBe(401);
  });
});

describe('GET /api/admin/notify-requests', () => {
  test('lists requests oldest first with a pending count', async () => {
    const app = buildTestApp();
    const { agent } = await loginAgent(app);

    const older = await prisma.notifyRequest.create({ data: { phone: '677111111' } });
    await new Promise((r) => setTimeout(r, 5));
    const newer = await prisma.notifyRequest.create({ data: { phone: '677222222' } });
    await prisma.notifyRequest.update({ where: { id: newer.id }, data: { notifiedAt: new Date() } });

    const res = await agent.get('/api/admin/notify-requests');

    expect(res.status).toBe(200);
    expect(res.body.requests.map((r) => r.id)).toEqual([older.id, newer.id]);
    expect(res.body.pendingCount).toBe(1);
  });
});

describe('POST /api/admin/notify-requests/:id/mark-notified', () => {
  test('sets notifiedAt and writes an audit log entry', async () => {
    const app = buildTestApp();
    const { agent, operator } = await loginAgent(app);
    const req = await prisma.notifyRequest.create({ data: { phone: '677333333' } });

    const res = await agent.post(`/api/admin/notify-requests/${req.id}/mark-notified`);

    expect(res.status).toBe(200);
    expect(res.body.request.notifiedAt).not.toBeNull();

    const log = await prisma.adminAuditLog.findFirst({ where: { action: 'notifyRequest.markNotified' } });
    expect(log.actor).toBe(`operator:${operator.id}`);
    expect(log.metadata.notifyRequestId).toBe(req.id);
  });

  test('is idempotent — a second call does not overwrite notifiedAt or duplicate the audit log', async () => {
    const app = buildTestApp();
    const { agent } = await loginAgent(app);
    const req = await prisma.notifyRequest.create({ data: { phone: '677444444' } });

    const first = await agent.post(`/api/admin/notify-requests/${req.id}/mark-notified`);
    const firstNotifiedAt = first.body.request.notifiedAt;

    const second = await agent.post(`/api/admin/notify-requests/${req.id}/mark-notified`);

    expect(second.status).toBe(200);
    expect(second.body.request.notifiedAt).toBe(firstNotifiedAt);

    const logs = await prisma.adminAuditLog.findMany({ where: { action: 'notifyRequest.markNotified' } });
    expect(logs.length).toBe(1);
  });

  test('returns 404 for an unknown id', async () => {
    const app = buildTestApp();
    const { agent } = await loginAgent(app);

    const res = await agent.post('/api/admin/notify-requests/00000000-0000-0000-0000-000000000000/mark-notified');
    expect(res.status).toBe(404);
  });
});
