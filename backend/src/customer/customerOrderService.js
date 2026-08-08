const { decimalToBigInt } = require('../db/money');
const { createOrder, transitionOrder, OrderNotFoundError } = require('../orders/orderService');
const { expireIfNeeded } = require('../orders/expiry');
const { generateOrderReference } = require('../orders/reference');
const { getRate } = require('../pricing/rateProvider');
const { computeQuote } = require('../pricing/quote');
const { AmountTooSmallError, RateUnavailableError } = require('../pricing/errors');
const {
  validateDestinationAddress,
  detectChainAndShapeError,
} = require('../validation/address');
const { AddressInvalidError, AddressBlockedError } = require('../validation/errors');
const { isOpenNow, reopenLabel, loadHoursConfig } = require('../config/hours');
const { InvalidAmountError, BscConfirmationRequiredError, PlatformClosedError } = require('./errors');
const { serializeOrder } = require('./orderSerializer');
const { getDepositInstructions } = require('./sellOrderService');

const QUOTE_TTL_MS = 15 * 60 * 1000;
const MAX_REFERENCE_ATTEMPTS = 5;

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function serializeRate(rate) {
  return {
    networkFeeXaf: rate.networkFeeXaf,
    marketRateMicros: rate.marketRateMicros.toString(),
    targetMarginBps: rate.targetMarginBps,
    quotedRateMicros: rate.quotedRateMicros.toString(),
  };
}

function computeUsdtAmount(xafAmount, chain, rate) {
  if (!isPositiveInteger(xafAmount)) {
    return { usdtAmount: null, amountError: 'Enter an amount in XAF' };
  }
  try {
    return { usdtAmount: computeQuote({ xafAmount, chain, rate }).usdtAmount.toString(), amountError: null };
  } catch (err) {
    if (err instanceof AmountTooSmallError) {
      return { usdtAmount: null, amountError: err.message };
    }
    throw err;
  }
}

// Before any wallet address is entered, there's no confirmed chain yet —
// but the customer has still typed an amount and wants to see roughly
// what they'll get. Mirrors the design mock's own "assumes the cheapest
// network" ledger note: quote against whichever chain is currently
// cheaper, clearly marked provisional, never good enough to submit an
// order against (createQuoteOrder always re-validates a real address).
async function previewWithoutAddress(prisma, xafAmount) {
  const [tron, bsc] = await Promise.all([getRate(prisma, 'TRON'), getRate(prisma, 'BSC')]);
  const cheaper = tron.networkFeeXaf <= bsc.networkFeeXaf ? { chain: 'TRON', rate: tron } : { chain: 'BSC', rate: bsc };
  const { usdtAmount, amountError } = computeUsdtAmount(xafAmount, cheaper.chain, cheaper.rate);

  return {
    addressValid: false,
    addressError: null,
    chain: cheaper.chain,
    addressHead: null,
    addressTail: null,
    requiresBscConfirmation: false,
    rate: serializeRate(cheaper.rate),
    amountError,
    usdtAmount,
    provisional: true,
  };
}

// Stateless — nothing is persisted. Used for the live-updating quote as
// the customer types on the swap screen, so an abandoned swap never
// leaves a QUOTED row behind.
async function previewQuote(prisma, { xafAmount, destinationAddress }) {
  if (!(destinationAddress || '').trim()) {
    return previewWithoutAddress(prisma, xafAmount);
  }

  let addressInfo;
  try {
    addressInfo = await validateDestinationAddress(destinationAddress);
  } catch (err) {
    if (err instanceof AddressInvalidError || err instanceof AddressBlockedError) {
      return {
        addressValid: false,
        addressError: err.message,
        chain: null,
        rate: null,
        amountError: null,
        usdtAmount: null,
        provisional: false,
      };
    }
    throw err;
  }

  const rate = await getRate(prisma, addressInfo.chain);
  // Rate/fee only depend on chain, so they're available the moment the
  // address resolves — the amount, and therefore usdtAmount, is separate
  // and may still be missing or too small.
  const { usdtAmount, amountError } = computeUsdtAmount(xafAmount, addressInfo.chain, rate);

  return {
    addressValid: true,
    chain: addressInfo.chain,
    addressHead: addressInfo.head,
    addressTail: addressInfo.tail,
    requiresBscConfirmation: addressInfo.chain === 'BSC',
    rate: serializeRate(rate),
    amountError,
    usdtAmount,
    provisional: false,
  };
}

async function safeDepositInstructions(prisma, chain) {
  try {
    return await getDepositInstructions(prisma, chain);
  } catch (err) {
    if (err instanceof RateUnavailableError) return null;
    throw err;
  }
}

async function getPaymentInstructions(prisma) {
  const settings = await prisma.platformSettings.findUniqueOrThrow({ where: { id: 'default' } });
  return {
    momoNetwork: settings.momoNetwork,
    momoNumber: settings.momoNumber,
    momoAccountName: settings.momoAccountName,
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
  const hours = await loadHoursConfig(prisma);
  if (!isOpenNow(hours)) {
    throw new PlatformClosedError(reopenLabel(hours));
  }

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

  return {
    order: serializeOrder(awaitingPayment),
    payment: await getPaymentInstructions(prisma),
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
    include: { rateSnapshot: true, review: true },
  });

  return {
    order: serializeOrder({ ...current, usdtAmount: decimalToBigInt(current.usdtAmount) }),
    // Only meaningful pre-payment, but harmless (and one less round trip
    // for the frontend) to include whenever it's still relevant.
    payment: current.status === 'AWAITING_PAYMENT' ? await getPaymentInstructions(prisma) : null,
    // Sell's mirror of `payment` above — the deposit address to send USDT
    // to. Swallows RateUnavailableError: an operator turning sell off
    // (clearing sellMarginBps/deposit address) shouldn't break the status
    // page for orders already in flight — they placed theirs when it was on.
    deposit: current.direction === 'SELL' && current.status === 'AWAITING_DEPOSIT' ? await safeDepositInstructions(prisma, current.chain) : null,
  };
}

module.exports = {
  detectChainAndShapeError,
  previewQuote,
  createQuoteOrder,
  claimPayment,
  getOrderStatus,
  serializeOrder,
};
