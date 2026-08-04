const express = require('express');
const { z } = require('zod');
const { createNotifyRequest } = require('../notifyService');

const notifySchema = z.object({
  phone: z
    .string()
    .trim()
    .min(6, 'Enter a phone number')
    .regex(/^[\d\s+-]+$/, 'Enter a valid phone number'),
});

function createNotifyRouter({ prisma, notifyRateLimit }) {
  const router = express.Router();

  router.post('/', notifyRateLimit, async (req, res, next) => {
    try {
      const { phone } = notifySchema.parse(req.body);
      await createNotifyRequest(prisma, phone);
      res.status(201).json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

module.exports = { createNotifyRouter };
