require('dotenv').config();
const { createPrismaClient } = require('../src/db/client');
const { hashPassword } = require('../src/admin/password');
const { toMicros } = require('../src/pricing/micros');

// Operators are provisioned here or by direct DB access — there is no
// signup route, mirroring the customer side's "no accounts" ethos.
// This is a dev/local convenience; a real provisioning process (or the
// admin-settings screen from the build order) replaces it later.
async function seedOperator(prisma) {
  const email = process.env.OPERATOR_SEED_EMAIL;
  const password = process.env.OPERATOR_SEED_PASSWORD;
  const displayName = process.env.OPERATOR_SEED_NAME || 'Operator';

  if (!email || !password) {
    // eslint-disable-next-line no-console
    console.log('Skipping operator seed: OPERATOR_SEED_EMAIL / OPERATOR_SEED_PASSWORD not set');
    return;
  }

  const passwordHash = await hashPassword(password);
  const operator = await prisma.operator.upsert({
    where: { email },
    update: { passwordHash, displayName },
    create: { email, passwordHash, displayName },
  });

  // eslint-disable-next-line no-console
  console.log(`Seeded operator ${operator.email}`);
}

// The manual RateProvider's data source — see src/pricing/rateProvider.js.
// Without this row, quoting fails closed (by design) rather than falling
// back to a guessed rate.
async function seedPlatformSettings(prisma) {
  const rate = process.env.SEED_XAF_USDT_RATE;
  const momoNumber = process.env.SEED_MOMO_NUMBER;
  const momoAccountName = process.env.SEED_MOMO_ACCOUNT_NAME;

  if (!rate || !momoNumber || !momoAccountName) {
    // eslint-disable-next-line no-console
    console.log('Skipping platform settings seed: SEED_XAF_USDT_RATE / SEED_MOMO_NUMBER / SEED_MOMO_ACCOUNT_NAME not set');
    return;
  }

  const momoNetwork = (process.env.SEED_MOMO_NETWORK || 'MTN').toUpperCase();
  if (!['MTN', 'ORANGE'].includes(momoNetwork)) {
    throw new Error('SEED_MOMO_NETWORK must be MTN or ORANGE');
  }

  const data = {
    xafUsdtRateMicros: toMicros(rate),
    tronNetworkFeeXaf: Number(process.env.SEED_TRON_NETWORK_FEE_XAF || 450),
    bscNetworkFeeXaf: Number(process.env.SEED_BSC_NETWORK_FEE_XAF || 120),
    targetMarginBps: Number(process.env.SEED_TARGET_MARGIN_BPS || 290),
    momoNetwork,
    momoNumber,
    momoAccountName,
    updatedBy: 'seed script',
  };

  await prisma.platformSettings.upsert({
    where: { id: 'default' },
    update: data,
    create: { id: 'default', ...data },
  });

  // eslint-disable-next-line no-console
  console.log(`Seeded platform settings: ${rate} XAF/USDT, ${momoNetwork} ${momoNumber}`);
}

async function main() {
  const prisma = createPrismaClient(process.env.DATABASE_URL);
  await seedOperator(prisma);
  await seedPlatformSettings(prisma);
  await prisma.$disconnect();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});
