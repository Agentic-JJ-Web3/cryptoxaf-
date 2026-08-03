const { env } = require('./config/env');
const { createPrismaClient } = require('./db/client');
const { createApp } = require('./app');

const prisma = createPrismaClient(env.databaseUrl);
const app = createApp({
  prisma,
  jwtSecret: env.jwtSecret,
  isProduction: env.isProduction,
  corsOrigin: env.corsOrigin,
});

app.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`CryptoXAF backend listening on :${env.port}`);
});
