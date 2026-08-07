const express = require('express');
const { getSummary } = require('../summaryService');

function createSummaryRouter({ prisma, requireAuth }) {
  const router = express.Router();
  router.use(requireAuth);

  router.get('/', async (req, res, next) => {
    try {
      res.json(await getSummary(prisma));
    } catch (err) {
      next(err);
    }
  });

  return router;
}

module.exports = { createSummaryRouter };
