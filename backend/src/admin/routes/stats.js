const express = require('express');
const { getDailyStats } = require('../statsService');

function createStatsRouter({ prisma, requireAuth }) {
  const router = express.Router();
  router.use(requireAuth);

  router.get('/', async (req, res, next) => {
    try {
      const requested = parseInt(req.query.days, 10);
      const days = Math.min(Math.max(Number.isFinite(requested) ? requested : 30, 1), 90);
      const result = await getDailyStats(prisma, { days });
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}

module.exports = { createStatsRouter };
