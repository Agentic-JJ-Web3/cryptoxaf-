const express = require('express');
const { z } = require('zod');
const { attemptLogin } = require('../loginService');
const { signSession, SESSION_COOKIE, TOKEN_TTL_MS } = require('../session');

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

function serializeOperator(operator) {
  return { id: operator.id, email: operator.email, displayName: operator.displayName };
}

function createAuthRouter({ prisma, jwtSecret, requireAuth, isProduction, loginRateLimit }) {
  const router = express.Router();

  router.post('/login', loginRateLimit, async (req, res, next) => {
    try {
      const { email, password } = loginSchema.parse(req.body);
      const operator = await attemptLogin(prisma, {
        email,
        password,
        ip: req.ip,
        userAgent: req.get('user-agent'),
      });

      const token = signSession(jwtSecret, operator);
      res.cookie(SESSION_COOKIE, token, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        maxAge: TOKEN_TTL_MS,
      });
      res.json({ operator: serializeOperator(operator) });
    } catch (err) {
      next(err);
    }
  });

  router.post('/logout', (req, res) => {
    res.clearCookie(SESSION_COOKIE);
    res.status(204).end();
  });

  router.get('/me', requireAuth, (req, res) => {
    res.json({ operator: serializeOperator(req.operator) });
  });

  return router;
}

module.exports = { createAuthRouter };
