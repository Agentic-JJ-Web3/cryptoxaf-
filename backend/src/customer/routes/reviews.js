const express = require('express');

const PUBLIC_LIMIT = 20;

function createReviewsRouter({ prisma }) {
  const router = express.Router();

  // Public — no auth, same trust tier as /api/quotes/market. Only ever
  // returns APPROVED reviews, and only the fields safe to show a stranger:
  // never orderId/reference (a bearer token for that customer's order —
  // see CLAUDE.md Security) and never anything from the order itself
  // beyond the chain it settled on.
  router.get('/', async (req, res, next) => {
    try {
      const reviews = await prisma.review.findMany({
        where: { status: 'APPROVED' },
        orderBy: { createdAt: 'desc' },
        take: PUBLIC_LIMIT,
        include: { order: { select: { chain: true } } },
      });

      res.json({
        reviews: reviews.map((r) => ({
          id: r.id,
          rating: r.rating,
          comment: r.comment,
          chain: r.order.chain,
          createdAt: r.createdAt,
        })),
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

module.exports = { createReviewsRouter };
