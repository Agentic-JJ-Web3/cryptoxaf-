const DAY_MS = 24 * 60 * 60 * 1000;

// UTC calendar-day bucketing — deterministic across environments regardless
// of the Postgres session timezone (see CLAUDE.md/memory gotcha: raw-SQL
// now()/date functions drift ~1hr against JS Date; bucketing off Prisma's
// own JS Date objects, never raw SQL, sidesteps that entirely).
function dayKey(date) {
  return date.toISOString().slice(0, 10);
}

function emptyBucket(date) {
  return { date, buyCount: 0, buyXaf: 0, sellCount: 0, sellXaf: 0 };
}

// Daily buy/sell volume for completed orders only — settled money, same
// posture as the queue's "today" stats. Gaps are filled with zero-buckets
// so the chart always renders a continuous `days`-long series rather than
// only the days something happened.
async function getDailyStats(prisma, { days = 30 } = {}) {
  const since = new Date(Date.now() - days * DAY_MS);
  const orders = await prisma.order.findMany({
    where: { status: 'COMPLETED', createdAt: { gte: since } },
    select: { direction: true, xafAmount: true, createdAt: true },
  });

  const byDay = new Map();
  for (const order of orders) {
    const key = dayKey(order.createdAt);
    const bucket = byDay.get(key) || emptyBucket(key);
    if (order.direction === 'SELL') {
      bucket.sellCount += 1;
      bucket.sellXaf += order.xafAmount;
    } else {
      bucket.buyCount += 1;
      bucket.buyXaf += order.xafAmount;
    }
    byDay.set(key, bucket);
  }

  const series = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const key = dayKey(new Date(Date.now() - i * DAY_MS));
    series.push(byDay.get(key) || emptyBucket(key));
  }

  const totals = series.reduce(
    (acc, d) => ({
      buyCount: acc.buyCount + d.buyCount,
      buyXaf: acc.buyXaf + d.buyXaf,
      sellCount: acc.sellCount + d.sellCount,
      sellXaf: acc.sellXaf + d.sellXaf,
    }),
    emptyBucket(undefined),
  );
  delete totals.date;

  return { days: series, totals };
}

module.exports = { getDailyStats };
