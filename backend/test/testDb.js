require('dotenv').config();

const { createPrismaClient } = require('../src/db/client');
const { toUsdtBaseUnits } = require('../src/config/chains');
const { createOrder, transitionOrder } = require('../src/orders/orderService');
const { hashPassword } = require('../src/admin/password');

if (!process.env.TEST_DATABASE_URL) {
  throw new Error('TEST_DATABASE_URL is not set — refusing to run against an unspecified database');
}
if (process.env.TEST_DATABASE_URL === process.env.DATABASE_URL) {
  throw new Error('TEST_DATABASE_URL must not point at the same database as DATABASE_URL');
}

const prisma = createPrismaClient(process.env.TEST_DATABASE_URL);

async function resetDb() {
  // TRUNCATE fires no FOR EACH ROW triggers, so this bypasses the
  // append-only log guards cleanly between tests.
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "OrderAuditLog", "Order", "RateSnapshot", "AdminAuditLog", "Operator", "NotifyRequest" CASCADE',
  );
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
  const direction = overrides.direction ?? 'BUY';
  return {
    reference: nextReference(),
    chain,
    direction,
    destinationAddress: chain === 'BSC' ? '0x1111111111111111111111111111111111111a' : 'TAbcdefghijklmnopqrstuvwxyzABCDE1',
    xafAmount: 10_000,
    usdtAmount: toUsdtBaseUnits(chain, '15'),
    quoteExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
    rateSnapshot: rateSnapshotInput(chain === 'BSC' ? { chain } : {}),
    // Sell requires the payout destination up front; buy collects it later
    // (claim-payment), so only default it in for sell fixtures.
    ...(direction === 'SELL' ? { customerMomoNumber: '677000000', customerMomoNetwork: 'MTN' } : {}),
    ...overrides,
  };
}

// Walks a fresh order through the legal transitions needed to land on
// `status`, so tests can start from any state without re-deriving the path
// through the state machine themselves. Buy and sell share the terminal
// statuses but reach them via different intermediate edges.
const BUY_PATH_TO_STATUS = {
  QUOTED: [],
  AWAITING_PAYMENT: ['AWAITING_PAYMENT'],
  PAYMENT_CLAIMED: ['AWAITING_PAYMENT', 'PAYMENT_CLAIMED'],
  PAYMENT_VERIFIED: ['AWAITING_PAYMENT', 'PAYMENT_CLAIMED', 'PAYMENT_VERIFIED'],
  COMPLETED: ['AWAITING_PAYMENT', 'PAYMENT_CLAIMED', 'PAYMENT_VERIFIED', 'COMPLETED'],
  REFUND_DUE: ['AWAITING_PAYMENT', 'PAYMENT_CLAIMED', 'REFUND_DUE'],
  REFUNDED: ['AWAITING_PAYMENT', 'PAYMENT_CLAIMED', 'REFUND_DUE', 'REFUNDED'],
  EXPIRED: ['EXPIRED'],
};

const SELL_PATH_TO_STATUS = {
  QUOTED: [],
  AWAITING_DEPOSIT: ['AWAITING_DEPOSIT'],
  DEPOSIT_CLAIMED: ['AWAITING_DEPOSIT', 'DEPOSIT_CLAIMED'],
  DEPOSIT_VERIFIED: ['AWAITING_DEPOSIT', 'DEPOSIT_CLAIMED', 'DEPOSIT_VERIFIED'],
  COMPLETED: ['AWAITING_DEPOSIT', 'DEPOSIT_CLAIMED', 'DEPOSIT_VERIFIED', 'COMPLETED'],
  REFUND_DUE: ['AWAITING_DEPOSIT', 'DEPOSIT_CLAIMED', 'REFUND_DUE'],
  REFUNDED: ['AWAITING_DEPOSIT', 'DEPOSIT_CLAIMED', 'REFUND_DUE', 'REFUNDED'],
  EXPIRED: ['EXPIRED'],
};

async function createOrderAt(status, overrides = {}) {
  const input = orderInput(overrides);
  const order = await createOrder(prisma, input);
  const pathToStatus = input.direction === 'SELL' ? SELL_PATH_TO_STATUS : BUY_PATH_TO_STATUS;
  let current = order;

  for (const toStatus of pathToStatus[status]) {
    current = await transitionOrder(prisma, {
      orderId: order.id,
      toStatus,
      actorType: 'OPERATOR',
      actor: 'operator:fixture',
      note: `advance to ${toStatus}`,
      data: {
        ...(toStatus === 'PAYMENT_CLAIMED'
          ? { paymentReference: 'MP-FIXTURE-TX', customerMomoNumber: '+237600000000' }
          : {}),
        ...(toStatus === 'DEPOSIT_CLAIMED' ? { paymentReference: '0xfixture-deposit-tx' } : {}),
        ...(toStatus === 'COMPLETED' ? { payoutReference: `0xhash-${order.id}` } : {}),
      },
    });
  }

  return current;
}

let operatorCounter = 0;
async function createTestOperator(overrides = {}) {
  operatorCounter += 1;
  const email = overrides.email ?? `operator${operatorCounter}-${Date.now()}@test.local`;
  const password = overrides.password ?? 'correct horse battery staple';
  const passwordHash = await hashPassword(password);

  const operator = await prisma.operator.create({
    data: {
      email,
      passwordHash,
      displayName: overrides.displayName ?? 'Test Operator',
      isActive: overrides.isActive ?? true,
    },
  });

  return { operator, password };
}

// Not part of resetDb()'s TRUNCATE list — this is config, not per-test
// data, and the pricing tests want it to persist for the whole file.
async function seedPlatformSettings(overrides = {}) {
  const data = {
    xafUsdtRateMicros: 650_000_000n,
    tronNetworkFeeXaf: 500,
    bscNetworkFeeXaf: 200,
    targetMarginBps: 150,
    rateTtlSeconds: 86400,
    momoNetwork: 'MTN',
    momoNumber: '677000000',
    momoAccountName: 'Test Account',
    updatedBy: 'test fixture',
    ...overrides,
  };

  return prisma.platformSettings.upsert({
    where: { id: 'default' },
    update: data,
    create: { id: 'default', ...data },
  });
}

module.exports = {
  prisma,
  resetDb,
  orderInput,
  rateSnapshotInput,
  createOrderAt,
  createTestOperator,
  seedPlatformSettings,
};
