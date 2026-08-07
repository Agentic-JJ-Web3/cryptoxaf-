const express = require('express');
const { z } = require('zod');
const { previewQuote } = require('../customerOrderService');
const { previewSellQuote } = require('../sellOrderService');
const { getMarketRate } = require('../../pricing/rateProvider');
const { isOpenNow, reopenLabel } = require('../../config/hours');

// Deliberately lenient: this backs live typing on the swap screen, where
// "amount not entered yet" or "address incomplete" are normal in-progress
// states, not errors. previewQuote() turns those into a structured
// response instead of a 400.
const previewSchema = z.object({
  xafAmount: z.number().finite().optional().default(0),
  destinationAddress: z.string().optional().default(''),
});

// Same leniency, sell side — chain is an explicit selection here (see
// CLAUDE.md "Sell flow"), so there's no "before an address" branch to model.
const sellPreviewSchema = z.object({
  usdtAmount: z.string().optional().default(''),
  chain: z.string().optional().default(''),
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

  router.post('/sell-preview', async (req, res, next) => {
    try {
      const { usdtAmount, chain } = sellPreviewSchema.parse(req.body);
      const result = await previewSellQuote(prisma, { usdtAmount, chain });
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // The live-rate ticker on the swap screen needs a market rate before the
  // customer has typed anything — chain-agnostic, so no address required.
  router.get('/market', async (req, res, next) => {
    try {
      const rate = await getMarketRate(prisma);
      res.json({
        marketRateMicros: rate.marketRateMicros.toString(),
        tronNetworkFeeXaf: rate.tronNetworkFeeXaf,
        bscNetworkFeeXaf: rate.bscNetworkFeeXaf,
        updatedAt: rate.updatedAt,
        isOpen: isOpenNow(),
        reopenLabel: reopenLabel(),
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

module.exports = { createQuotesRouter };
