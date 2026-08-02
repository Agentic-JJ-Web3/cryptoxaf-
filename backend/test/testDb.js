require('dotenv').config();

const { createPrismaClient } = require('../src/db/client');
const { toUsdtBaseUnits } = require('../src/config/chains');

if (!process.env.TEST_DATABASE_URL) {
  throw new Error('TEST_DATABASE_URL is not set — refusing to run against an unspecified database');
}
if (process.env.TEST_DATABASE_URL === process.env.DATABASE_URL) {
  throw new Error('TEST_DATABASE_URL must not point at the same database as DATABASE_URL');
}

const prisma = createPrismaClient(process.env.TEST_DATABASE_URL);

async function resetDb() {
  // TRUNCATE fires no FOR EACH ROW triggers, so this bypasses the
  // audit log's append-only guard cleanly between tests.
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "OrderAuditLog", "Order", "RateSnapshot" CASCADE');
}

let referenceCounter = 0;
function nextReference() {
  referenceCounter += 1;
  return `TEST-REF-${referenceCounter}-${Date.now()}`;
}

function rateSnapshotInput(overrides = {}) {
  return {
    chain: 'TRON',
    marketRateMicros: 650_000_000n,
    networkFeeXaf: 500,
    targetMarginBps: 150,
    quotedRateMicros: 659_750_000n,
    ...overrides,
  };
}

function orderInput(overrides = {}) {
  const chain = overrides.chain ?? 'TRON';
  return {
    reference: nextReference(),
    chain,
    destinationAddress: chain === 'BSC' ? '0x1111111111111111111111111111111111111a' : 'TAbcdefghijklmnopqrstuvwxyzABCDE1',
    xafAmount: 10_000,
    usdtAmount: toUsdtBaseUnits(chain, '15'),
    quoteExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
    rateSnapshot: rateSnapshotInput(chain === 'BSC' ? { chain } : {}),
    ...overrides,
  };
}

module.exports = { prisma, resetDb, orderInput, rateSnapshotInput };
