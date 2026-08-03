const { SESSION_COOKIE, verifySession } = require('../session');

function createRequireAuth({ prisma, jwtSecret }) {
  return async function requireAuth(req, res, next) {
    const token = req.cookies?.[SESSION_COOKIE];
    if (!token) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    let payload;
    try {
      payload = verifySession(jwtSecret, token);
    } catch {
      return res.status(401).json({ error: 'Session expired or invalid' });
    }

    const operator = await prisma.operator.findUnique({ where: { id: payload.sub } });
    if (!operator || !operator.isActive) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    req.operator = operator;
    next();
  };
}

module.exports = { createRequireAuth };
