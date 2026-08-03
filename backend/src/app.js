const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const cors = require('cors');

const { createRequireAuth } = require('./admin/middleware/requireAuth');
const { createLoginRateLimit } = require('./admin/middleware/rateLimit');
const { createAuthRouter } = require('./admin/routes/auth');
const { createOrdersRouter: createAdminOrdersRouter } = require('./admin/routes/orders');
const { createQuotesRouter } = require('./customer/routes/quotes');
const { createOrdersRouter: createCustomerOrdersRouter } = require('./customer/routes/orders');
const { errorHandler } = require('./errorHandler');

// Builds a configured Express app without binding a port, so tests can
// drive it directly (supertest) and hosting platforms that inject the
// listener themselves aren't fighting an app that already called listen().
function createApp({ prisma, jwtSecret, isProduction = false, corsOrigin }) {
  if (!prisma) throw new Error('createApp requires a prisma client');
  if (!jwtSecret) throw new Error('createApp requires a jwtSecret');

  const app = express();
  const requireAuth = createRequireAuth({ prisma, jwtSecret });

  // Trust the first proxy hop in production (Render/Railway/Fly-style
  // deploys sit behind one) so req.ip and the rate limiter see the real
  // client address instead of the proxy's.
  app.set('trust proxy', isProduction ? 1 : false);

  app.use(helmet());
  // The frontend (PWA) is deployed separately from this API — see
  // CLAUDE.md's stack split. credentials:true is required for the admin
  // session cookie to survive a cross-origin request.
  app.use(cors({ origin: corsOrigin || true, credentials: true }));
  app.use(express.json());
  app.use(cookieParser());

  app.get('/healthz', (req, res) => res.json({ status: 'ok' }));

  app.use(
    '/api/admin/auth',
    createAuthRouter({ prisma, jwtSecret, requireAuth, isProduction, loginRateLimit: createLoginRateLimit() }),
  );
  app.use('/api/admin/orders', createAdminOrdersRouter({ prisma, requireAuth }));

  app.use('/api/quotes', createQuotesRouter({ prisma }));
  app.use('/api/orders', createCustomerOrdersRouter({ prisma }));

  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
