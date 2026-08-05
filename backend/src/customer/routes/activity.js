const express = require('express');
const { getRecentActivity } = require('../activityService');

function createActivityRouter({ prisma }) {
  const router = express.Router();

  // Public — no auth, same trust tier as /api/quotes/market.
  router.get('/', async (req, res, next) => {
    try {
      const activity = await getRecentActivity(prisma);
      res.json({ activity });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

module.exports = { createActivityRouter };
