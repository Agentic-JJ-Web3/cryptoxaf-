const RECENT_WINDOW_MS = 24 * 60 * 60 * 1000;
const RECENT_LIMIT = 20;
const BUCKET_XAF = 5_000;

// Real, anonymized completed orders only — see CLAUDE.md's Reviews/Live
// activity section. xafAmount is bucketed to the nearest 5,000 XAF so a
// ticker line can never be matched back to one specific real order's exact
// amount; nothing identifying (reference, address, MoMo number) is ever
// included. Empty when nothing recent — the frontend hides the ticker
// entirely rather than render a placeholder, never fabricated activity.
async function getRecentActivity(prisma) {
  const since = new Date(Date.now() - RECENT_WINDOW_MS);

  const orders = await prisma.order.findMany({
    where: { status: 'COMPLETED', updatedAt: { gte: since } },
    orderBy: { updatedAt: 'desc' },
    take: RECENT_LIMIT,
    select: { chain: true, xafAmount: true, updatedAt: true },
  });

  const now = Date.now();
  return orders.map((o) => ({
    chain: o.chain,
    // Floored at one bucket — "~0 XAF" would read as broken, not honest.
    roundedXaf: Math.max(BUCKET_XAF, Math.round(o.xafAmount / BUCKET_XAF) * BUCKET_XAF),
    minutesAgo: Math.max(0, Math.floor((now - o.updatedAt.getTime()) / 60000)),
  }));
}

module.exports = { getRecentActivity };
