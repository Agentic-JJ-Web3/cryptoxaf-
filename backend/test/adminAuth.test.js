const request = require('supertest');
const { prisma, resetDb, createTestOperator } = require('./testDb');
const { buildTestApp } = require('./testApp');

afterEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('POST /api/admin/auth/login', () => {
  test('accepts correct credentials, sets an httpOnly cookie, and never returns the password hash', async () => {
    const { operator, password } = await createTestOperator({ email: 'ops@cryptoxaf.local' });
    const app = buildTestApp();

    const res = await request(app).post('/api/admin/auth/login').send({ email: operator.email, password });

    expect(res.status).toBe(200);
    expect(res.body.operator).toEqual({ id: operator.id, email: operator.email, displayName: operator.displayName });
    expect(res.body.operator.passwordHash).toBeUndefined();

    const cookie = res.headers['set-cookie']?.[0];
    expect(cookie).toMatch(/cxaf_admin_session=/);
    expect(cookie).toMatch(/HttpOnly/i);

    const logs = await prisma.adminAuditLog.findMany({ where: { action: 'operator.login.success' } });
    expect(logs).toHaveLength(1);
    expect(logs[0].actor).toBe(`operator:${operator.id}`);
  });

  test('rejects a wrong password without revealing whether the email exists', async () => {
    const { operator } = await createTestOperator({ email: 'ops@cryptoxaf.local' });
    const app = buildTestApp();

    const wrongPassword = await request(app)
      .post('/api/admin/auth/login')
      .send({ email: operator.email, password: 'definitely-wrong' });
    const unknownEmail = await request(app)
      .post('/api/admin/auth/login')
      .send({ email: 'nobody@cryptoxaf.local', password: 'whatever' });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body.error).toBe(unknownEmail.body.error);

    const logs = await prisma.adminAuditLog.findMany({ where: { action: 'operator.login.failure' } });
    expect(logs).toHaveLength(2);
    expect(logs.map((l) => l.actor).sort()).toEqual(
      ['unknown:nobody@cryptoxaf.local', `unknown:${operator.email}`].sort(),
    );
  });

  test('rejects a deactivated operator', async () => {
    const { operator, password } = await createTestOperator({ email: 'inactive@cryptoxaf.local', isActive: false });
    const app = buildTestApp();

    const res = await request(app).post('/api/admin/auth/login').send({ email: operator.email, password });
    expect(res.status).toBe(401);
  });

  test('rejects a malformed request body with 400', async () => {
    const app = buildTestApp();
    const res = await request(app).post('/api/admin/auth/login').send({ email: 'not-an-email', password: '' });
    expect(res.status).toBe(400);
  });

  test('rate-limits repeated login attempts from the same client', async () => {
    const app = buildTestApp();
    const attempts = [];
    for (let i = 0; i < 11; i += 1) {
      attempts.push(
        // eslint-disable-next-line no-await-in-loop
        await request(app).post('/api/admin/auth/login').send({ email: 'nobody@cryptoxaf.local', password: 'x' }),
      );
    }

    const statuses = attempts.map((r) => r.status);
    expect(statuses.slice(0, 10).every((s) => s === 401)).toBe(true);
    expect(statuses[10]).toBe(429);
  });
});

describe('session cookie', () => {
  test('GET /me requires authentication', async () => {
    const app = buildTestApp();
    const res = await request(app).get('/api/admin/auth/me');
    expect(res.status).toBe(401);
  });

  test('GET /me succeeds with a valid session cookie, and logout invalidates it', async () => {
    const { operator, password } = await createTestOperator({ email: 'ops@cryptoxaf.local' });
    const app = buildTestApp();
    const agent = request.agent(app);

    await agent.post('/api/admin/auth/login').send({ email: operator.email, password });

    const me = await agent.get('/api/admin/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.operator.id).toBe(operator.id);

    await agent.post('/api/admin/auth/logout');
    const afterLogout = await agent.get('/api/admin/auth/me');
    expect(afterLogout.status).toBe(401);
  });
});
