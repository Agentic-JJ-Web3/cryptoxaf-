const { CHAINS } = require('../config/chains');
const { decimalToBigInt } = require('../db/money');
const { createOrder, transitionOrder, OrderNotFoundError } = require('../orders/orderService');
const { expireIfNeeded } = require('../orders/expiry');
const { generateOrderReference } = require('../orders/reference');
const { getRate } = require('../pricing/rateProvider');
const { computeQuote } = require('../pricing/quote');
const { AmountTooSmallError } = require('../pricing/errors');
const {
  validateDestinationAddress,
  detectChainAndShapeError,
} = require('../validation/address');
const { AddressInvalidError, AddressBlockedError } = require('../validation/errors');
const { InvalidAmountError, BscConfirmationRequiredError } = require('./errors');

const QUOTE_TTL_MS = 15 * 60 * 1000;
const MAX_REFERENCE_ATTEMPTS = 5;

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function serializeQuote(quote) {
  return {
    networkFeeXaf: quote.networkFeeXaf,
    marketRateMicros: quote.marketRateMicros.toString(),
    targetMarginBps: quote.targetMarginBps,
    quotedRateMicros: quote.quotedRateMicros.toString(),
    usdtAmount: quote.usdtAmount.toString(),
  };
}

function serializeOrder(order) {
  const explorerTxUrl = order.payoutTxHash ? CHAINS[order.chain].explorerTxUrl(order.payoutTxHash) : null;

  return {
    reference: order.reference,
    status: order.status,
    chain: order.chain,
    destinationAddress: order.destinationAddress,
    xafAmount: order.xafAmount,
    usdtAmount: order.usdtAmount.toString(),
    paymentReference: order.paymentReference,
    payoutTxHash: order.payoutTxHash,
    explorerTxUrl,
    refundReason: order.refundReason,
    quoteExpiresAt: order.quoteExpiresAt,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    rateSnapshot: order.rateSnapshot
      ? {
          marketRateMicros: order.rateSnapshot.marketRateMicros.toString(),
          networkFeeXaf: order.rateSnapshot.networkFeeXaf,
          quotedRateMicros: order.rateSnapshot.quotedRateMicros.toString(),
        }
      : undefined,
  };
}

// Stateless — nothing is persisted. Used for the live-updating quote as
// the customer types on the swap screen, so an abandoned swap never
// leaves a QUOTED row behind.
async function previewQuote(prisma, { xafAmount, destinationAddress }) {
  let addressInfo;
  try {
    addressInfo = await validateDestinationAddress(destinationAddress);
  } catch (err) {
    if (err instanceof AddressInvalidError || err instanceof AddressBlockedError) {
      return { addressValid: false, addressError: err.message, chain: null, quote: null };
    }
    throw err;
  }

  const rate = await getRate(prisma, addressInfo.chain);

  let quote = null;
  let amountError = null;
  if (isPositiveInteger(xafAmount)) {
    try {
      quote = computeQuote({ xafAmount, chain: addressInfo.chain, rate });
    } catch (err) {
      if (err instanceof AmountTooSmallError) {
        amountError = err.message;
      } else {
        throw err;
      }
    }
  } else {
    amountError = 'Enter an amount in XAF';
  }

  return {
    addressValid: true,
    chain: addressInfo.chain,
    addressHead: addressInfo.head,
    addressTail: addressInfo.tail,
    requiresBscConfirmation: addressInfo.chain === 'BSC',
    amountError,
    quote: quote ? serializeQuote(quote) : null,
  };
}

async function createOrderWithUniqueReference(prisma, buildData) {
  for (let attempt = 0; attempt < MAX_REFERENCE_ATTEMPTS; attempt += 1) {
    const reference = generateOrderReference();
    try {
      // eslint-disable-next-line no-await-in-loop
      return await createOrder(prisma, buildData(reference));
    } catch (err) {
      const isReferenceCollision = err?.code === 'P2002';
      if (!isReferenceCollision || attempt === MAX_REFERENCE_ATTEMPTS - 1) throw err;
    }
  }
  throw new Error('unreachable');
}

// The real, persisting call — fired once, when the customer hits
// "Continue to payment". Re-validates everything the preview already
// showed, since client-side state is never trusted for order creation.
async function createQuoteOrder(prisma, { xafAmount, destinationAddress, bscConfirmed }) {
  if (!isPositiveInteger(xafAmount)) {
    throw new InvalidAmountError();
  }

  const addressInfo = await validateDestinationAddress(destinationAddress);

  if (addressInfo.chain === 'BSC' && !bscConfirmed) {
    throw new BscConfirmationRequiredError();
  }

  const rate = await getRate(prisma, addressInfo.chain);
  const quote = computeQuote({ xafAmount, chain: addressInfo.chain, rate });

  const order = await createOrderWithUniqueReference(prisma, (reference) => ({
    reference,
    chain: addressInfo.chain,
    destinationAddress: addressInfo.normalizedAddress,
    xafAmount,
    usdtAmount: quote.usdtAmount,
    quoteExpiresAt: new Date(Date.now() + QUOTE_TTL_MS),
    rateSnapshot: {
      chain: addressInfo.chain,
      marketRateMicros: quote.marketRateMicros,
      networkFeeXaf: quote.networkFeeXaf,
      targetMarginBps: quote.targetMarginBps,
      quotedRateMicros: quote.quotedRateMicros,
    },
  }));

  // System immediately advances QUOTED -> AWAITING_PAYMENT: the reference
  // is only meaningful to the customer once payment instructions exist,
  // and there's no separate customer action between quoting and seeing
  // those instructions.
  const awaitingPayment = await transitionOrder(prisma, {
    orderId: order.id,
    toStatus: 'AWAITING_PAYMENT',
    actorType: 'SYSTEM',
    actor: 'system',
    note: 'payment instructions issued',
  });

  const settings = await prisma.platformSettings.findUniqueOrThrow({ where: { id: 'default' } });

  return {
    order: serializeOrder(awaitingPayment),
    payment: {
      momoNetwork: settings.momoNetwork,
      momoNumber: settings.momoNumber,
      momoAccountName: settings.momoAccountName,
    },
  };
}

async function findByReference(prisma, reference) {
  const order = await prisma.order.findUnique({ where: { reference }, include: { rateSnapshot: true } });
  if (!order) {
    throw new OrderNotFoundError(reference);
  }
  return order;
}

async function claimPayment(prisma, { reference, momoTxId, customerMomoNumber }) {
  const order = await findByReference(prisma, reference);
  const current = await expireIfNeeded(prisma, order);

  const updated = await transitionOrder(prisma, {
    orderId: current.id,
    toStatus: 'PAYMENT_CLAIMED',
    actorType: 'CUSTOMER',
    actor: 'customer',
    note: 'customer submitted MoMo transaction id',
    data: { paymentReference: momoTxId, customerMomoNumber },
  });

  return serializeOrder(updated);
}

async function getOrderStatus(prisma, reference) {
  const order = await prisma.order.findUnique({ where: { reference }, include: { rateSnapshot: true } });
  if (!order) return null;

  // Side-effecting only: may flip status to EXPIRED in the DB. Re-fetch
  // fresh afterward rather than branching on what it returned, so there is
  // exactly one place usdtAmount gets converted from Decimal to BigInt.
  await expireIfNeeded(prisma, order);

  const current = await prisma.order.findUniqueOrThrow({
    where: { id: order.id },
    include: { rateSnapshot: true },
  });

  return serializeOrder({ ...current, usdtAmount: decimalToBigInt(current.usdtAmount) });
}

module.exports = {
  detectChainAndShapeError,
  previewQuote,
  createQuoteOrder,
  claimPayment,
  getOrderStatus,
};
