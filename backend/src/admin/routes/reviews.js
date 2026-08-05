const express = require('express');
const { z } = require('zod');
const reviewService = require('../reviewService');

const statusQuerySchema = z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional();

function createReviewsRouter({ prisma, requireAuth }) {
  const router = express.Router();
  router.use(requireAuth);

  router.get('/', async (req, res, next) => {
    try {
      const status = statusQuerySchema.parse(req.query.status);
      const result = await reviewService.listReviews(prisma, { status });
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  router.post('/:id/approve', async (req, res, next) => {
    try {
      const review = await reviewService.approve(prisma, { id: req.params.id, operator: req.operator });
      if (!review) {
        return res.status(404).json({ error: 'Review not found or already moderated' });
      }
      res.json({ review });
    } catch (err) {
      next(err);
    }
  });

  router.post('/:id/reject', async (req, res, next) => {
    try {
      const review = await reviewService.reject(prisma, { id: req.params.id, operator: req.operator });
      if (!review) {
        return res.status(404).json({ error: 'Review not found or already moderated' });
      }
      res.json({ review });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

module.exports = { createReviewsRouter };
