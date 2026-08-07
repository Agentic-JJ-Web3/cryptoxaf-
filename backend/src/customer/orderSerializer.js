const { CHAINS } = require('../config/chains');

// Shared by customerOrderService.js and sellOrderService.js — split out to
// its own module (rather than living in customerOrderService.js) because
// sellOrderService.js needs it too, and customerOrderService.js separately
// needs sellOrderService.js (for deposit instructions on getOrderStatus).
// Having the serializer here avoids a require cycle between the two.
function serializeOrder(order) {
  // Buy's payoutReference is a real on-chain hash — link to it. Sell's is a
  // MoMo payout confirmation code, never a tx hash, so there's no explorer
  // link to build.
  const explorerTxUrl =
    order.direction === 'BUY' && order.payoutReference
      ? CHAINS[order.chain].explorerTxUrl(order.payoutReference)
      : null;

  return {
    reference: order.reference,
    status: order.status,
    direction: order.direction,
    chain: order.chain,
    destinationAddress: order.destinationAddress,
    xafAmount: order.xafAmount,
    usdtAmount: order.usdtAmount.toString(),
    paymentReference: order.paymentReference,
    depositReceiptImagePath: order.depositReceiptImagePath ? true : false,
    customerMomoNumber: order.customerMomoNumber,
    customerMomoNetwork: order.customerMomoNetwork,
    payoutReference: order.payoutReference,
    explorerTxUrl,
    refundReason: order.refundReason,
    // Whether the review prompt should show on the status page — never the
    // review's own content, this endpoint has no reason to expose that.
    hasReview: order.review != null,
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

module.exports = { serializeOrder };
