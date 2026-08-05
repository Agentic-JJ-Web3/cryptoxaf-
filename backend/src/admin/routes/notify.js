const express = require('express');
const notifyService = require('../notifyService');

function createNotifyRequestsRouter({ prisma, requireAuth }) {
  const router = express.Router();
  router.use(requireAuth);

  router.get('/', async (req, res, next) => {
    try {
      const result = await notifyService.listNotifyRequests(prisma);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  router.post('/:id/mark-notified', async (req, res, next) => {
    try {
      const request = await notifyService.markNotified(prisma, { id: req.params.id, operator: req.operator });
      if (!request) {
        return res.status(404).json({ error: 'Notify request not found' });
      }
      res.json({ request });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

module.exports = { createNotifyRequestsRouter };
