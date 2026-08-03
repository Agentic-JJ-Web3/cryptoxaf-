const express = require('express');
const { z } = require('zod');
const { previewQuote } = require('../customerOrderService');

// Deliberately lenient: this backs live typing on the swap screen, where
// "amount not entered yet" or "address incomplete" are normal in-progress
// states, not errors. previewQuote() turns those into a structured
// response instead of a 400.
const previewSchema = z.object({
  xafAmount: z.number().finite().optional().default(0),
  destinationAddress: z.string().optional().default(''),
});

function createQuotesRouter({ prisma }) {
  const router = express.Router();

  router.post('/preview', async (req, res, next) => {
    try {
      const { xafAmount, destinationAddress } = previewSchema.parse(req.body);
      const result = await previewQuote(prisma, { xafAmount, destinationAddress });
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}

module.exports = { createQuotesRouter };
