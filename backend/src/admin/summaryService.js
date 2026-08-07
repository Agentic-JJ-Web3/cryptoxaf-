const { ACTIONABLE_STATUSES } = require('./orderAdminService');

// Backs the sidebar's notification badges — cheap counts only, no row
// data, so the layout can poll this on every page without the cost of
// re-fetching the full queue/review/notify lists just to show a number.
async function getSummary(prisma) {
  const [actionableOrders, pendingReviews, pendingNotifyRequests] = await Promise.all([
    prisma.order.count({ where: { status: { in: [...ACTIONABLE_STATUSES] } } }),
    prisma.review.count({ where: { status: 'PENDING' } }),
    prisma.notifyRequest.count({ where: { notifiedAt: null } }),
  ]);

  return { actionableOrders, pendingReviews, pendingNotifyRequests };
}

module.exports = { getSummary };
