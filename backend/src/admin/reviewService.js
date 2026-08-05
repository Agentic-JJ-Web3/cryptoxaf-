// No rating-based auto-filtering — every review (1-5 stars) goes through
// this same PENDING -> APPROVED/REJECTED queue, decided by a human. See
// CLAUDE.md's Reviews section.

function serializeReview(review) {
  return {
    id: review.id,
    rating: review.rating,
    comment: review.comment,
    status: review.status,
    chain: review.order.chain,
    // Shown to the operator only, for moderation context — never leaked
    // through the public /api/reviews endpoint.
    orderReference: review.order.reference,
    createdAt: review.createdAt,
    moderatedAt: review.moderatedAt,
  };
}

async function listReviews(prisma, { status = 'PENDING' } = {}) {
  const [reviews, pendingCount] = await Promise.all([
    prisma.review.findMany({
      where: { status },
      orderBy: { createdAt: 'asc' },
      include: { order: { select: { chain: true, reference: true } } },
    }),
    prisma.review.count({ where: { status: 'PENDING' } }),
  ]);

  return { reviews: reviews.map(serializeReview), pendingCount };
}

async function moderate(prisma, { id, operator, status }) {
  // Guarded by the where clause, not a separate read-then-write — only a
  // still-PENDING row is affected, so a double-tap or a race against
  // another operator can't flip an already-moderated review a second time.
  const result = await prisma.review.updateMany({
    where: { id, status: 'PENDING' },
    data: { status, moderatedAt: new Date(), moderatedBy: `operator:${operator.id}` },
  });
  if (result.count === 0) return null;

  const review = await prisma.review.findUnique({
    where: { id },
    include: { order: { select: { chain: true, reference: true } } },
  });

  await prisma.adminAuditLog.create({
    data: {
      actor: `operator:${operator.id}`,
      action: status === 'APPROVED' ? 'review.approve' : 'review.reject',
      metadata: { reviewId: id },
    },
  });

  return serializeReview(review);
}

async function approve(prisma, { id, operator }) {
  return moderate(prisma, { id, operator, status: 'APPROVED' });
}

async function reject(prisma, { id, operator }) {
  return moderate(prisma, { id, operator, status: 'REJECTED' });
}

module.exports = { listReviews, approve, reject };
