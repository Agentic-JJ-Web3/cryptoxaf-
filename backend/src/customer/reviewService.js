const { OrderNotFoundError } = require('../orders/orderService');
const { OrderNotReviewableError, ReviewAlreadyExistsError } = require('./errors');

// A buyer can rate+comment on their own completed swap, once, using the
// same reference-as-bearer-token trust model as claim-payment/order status
// — no separate login, the reference itself is proof of the order. Held
// as PENDING until an operator moderates it (see admin/reviewService.js);
// this function never makes a review visible on its own.
async function submitReview(prisma, { reference, rating, comment }) {
  const order = await prisma.order.findUnique({ where: { reference }, include: { review: true } });
  if (!order) {
    throw new OrderNotFoundError(reference);
  }
  if (order.status !== 'COMPLETED') {
    throw new OrderNotReviewableError();
  }
  if (order.review) {
    throw new ReviewAlreadyExistsError();
  }

  try {
    await prisma.review.create({
      data: {
        orderId: order.id,
        rating,
        comment: comment || null,
      },
    });
  } catch (err) {
    // The pre-check above is racy under a double-submit — the @unique
    // constraint on orderId is the real guard, this just maps its
    // violation back to the same friendly error.
    if (err?.code === 'P2002') {
      throw new ReviewAlreadyExistsError();
    }
    throw err;
  }
}

module.exports = { submitReview };
