const { CHAINS, toUsdtBaseUnits } = require('../config/chains');
const { createOrder, transitionOrder, OrderNotFoundError } = require('../orders/orderService');
const { serializeOrder } = require('./orderSerializer');
const { expireIfNeeded } = require('../orders/expiry');
const { generateOrderReference } = require('../orders/reference');
const { getSellRate } = require('../pricing/rateProvider');
const { computeSellQuote } = require('../pricing/quote');
const { AmountTooSmallError } = require('../pricing/errors');
const { validateDestinationAddress } = require('../validation/address');
const { AddressInvalidError } = require('../validation/errors');
const { isOpenNow, reopenLabel } = require('../config/hours');
const {
  InvalidUsdtAmountError,
  PlatformClosedError,
  DepositProofRequiredError,
} = require('./errors');

const QUOTE_TTL_MS = 15 * 60 * 1000;
const MAX_REFERENCE_ATTEMPTS = 5;
const USDT_AMOUNT_SHAPE = /^\d+(\.\d+)?$/;

// A human USDT amount ("50.5") -> base units for `chain`, or null with a
// friendly reason. Mirrors computeUsdtAmount's shape on the buy side.
function parseUsdtAmount(humanAmount, chain) {
  const trimmed = String(humanAmount ?? '').trim();
  if (!USDT_AMOUNT_SHAPE.test(trimmed) || Number(trimmed) <= 0) {
    return { usdtAmountBase: null, amountError: 'Enter a USDT amount' };
  }
  try {
    return { usdtAmountBase: toUsdtBaseUnits(chain, trimmed), amountError: null };
  } catch {
    return { usdtAmountBase: null, amountError: 'Too many decimal places for this network' };
  }
}

function computeXafPayout(usdtAmountBase, chain, rate) {
  try {
    return { xafAmount: computeSellQuote({ usdtAmount: usdtAmountBase, chain, rate }).xafAmount, amountError: null };
  } catch (err) {
    if (err instanceof AmountTooSmallError) {
      return { xafAmount: null, amountError: err.message };
    }
    throw err;
  }
}

function serializeSellRate(rate) {
  return {
    marketRateMicros: rate.marketRateMicros.toString(),
    targetMarginBps: rate.targetMarginBps,
    quotedRateMicros: rate.quotedRateMicros.toString(),
  };
}

// Stateless, mirrors previewQuote — but chain is always explicit here
// (the customer picks which of the platform's deposit addresses to use;
// there's no address to detect a chain from, see CLAUDE.md "Sell flow").
async function previewSellQuote(prisma, { usdtAmount, chain }) {
  if (!CHAINS[chain]) {
    return { chainValid: false, rate: null, xafAmount: null, amountError: null };
  }

  const rate = await getSellRate(prisma, chain);
  const { usdtAmountBase, amountError: parseError } = parseUsdtAmount(usdtAmount, chain);

  if (parseError) {
    return { chainValid: true, rate: serializeSellRate(rate), xafAmount: null, amountError: parseError };
  }

  const { xafAmount, amountError } = computeXafPayout(usdtAmountBase, chain, rate);
  return { chainValid: true, rate: serializeSellRate(rate), xafAmount, amountError };
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

// destinationAddress here is the customer's OWN wallet — collected only as
// a refund-safety-net if the deposit is ever rejected, never a payout
// target for sell. Validated the same way a buy-side payout address is.
async function createSellOrder(prisma, { usdtAmount, chain, destinationAddress, customerMomoNumber, customerMomoNetwork }) {
  if (!isOpenNow()) {
    throw new PlatformClosedError(reopenLabel());
  }
  if (!CHAINS[chain]) {
    throw new InvalidUsdtAmountError();
  }

  const { usdtAmountBase, amountError } = parseUsdtAmount(usdtAmount, chain);
  if (amountError) {
    throw new InvalidUsdtAmountError();
  }

  const addressInfo = await validateDestinationAddress(destinationAddress);
  // The refund-safety-net address must be on the same chain as the
  // deposit — a mismatch here would send a future refund to the wrong network.
  if (addressInfo.chain !== chain) {
    throw new AddressInvalidError(`Your wallet address must be on the same network you're sending USDT from.`);
  }

  const rate = await getSellRate(prisma, chain);
  const quote = computeSellQuote({ usdtAmount: usdtAmountBase, chain, rate });

  const order = await createOrderWithUniqueReference(prisma, (reference) => ({
    reference,
    direction: 'SELL',
    chain,
    destinationAddress: addressInfo.normalizedAddress,
    xafAmount: quote.xafAmount,
    usdtAmount: usdtAmountBase,
    quoteExpiresAt: new Date(Date.now() + QUOTE_TTL_MS),
    customerMomoNumber,
    customerMomoNetwork,
    rateSnapshot: {
      chain,
      marketRateMicros: quote.marketRateMicros,
      // No network fee on the sell side — the customer pays their own gas
      // to deposit, there's no equivalent platform cost passed through.
      networkFeeXaf: 0,
      targetMarginBps: quote.targetMarginBps,
      quotedRateMicros: quote.quotedRateMicros,
    },
  }));

  const awaitingDeposit = await transitionOrder(prisma, {
    orderId: order.id,
    toStatus: 'AWAITING_DEPOSIT',
    actorType: 'SYSTEM',
    actor: 'system',
    note: 'deposit instructions issued',
  });

  return {
    order: serializeOrder(awaitingDeposit),
    deposit: await getDepositInstructions(prisma, chain),
  };
}

async function getDepositInstructions(prisma, chain) {
  const rate = await getSellRate(prisma, chain);
  return { chain, depositAddress: rate.depositAddress };
}

async function findByReference(prisma, reference) {
  const order = await prisma.order.findUnique({ where: { reference } });
  if (!order) {
    throw new OrderNotFoundError(reference);
  }
  return order;
}

// At least one of a tx hash or a receipt screenshot is required — see
// CLAUDE.md "Sell flow". When only a screenshot is given, there's nothing
// to look up on-chain; the operator's manual review of the image is the
// verification for that order.
async function claimDeposit(prisma, { reference, txHash, receiptImagePath }) {
  const trimmedTxHash = (txHash || '').trim();
  if (!trimmedTxHash && !receiptImagePath) {
    throw new DepositProofRequiredError();
  }

  const order = await findByReference(prisma, reference);
  const current = await expireIfNeeded(prisma, order);

  const updated = await transitionOrder(prisma, {
    orderId: current.id,
    toStatus: 'DEPOSIT_CLAIMED',
    actorType: 'CUSTOMER',
    actor: 'customer',
    note: trimmedTxHash ? 'customer submitted deposit tx hash' : 'customer submitted a receipt screenshot',
    data: {
      paymentReference: trimmedTxHash || null,
      depositReceiptImagePath: receiptImagePath || null,
    },
  });

  return serializeOrder(updated);
}

module.exports = { previewSellQuote, createSellOrder, claimDeposit, getDepositInstructions };
