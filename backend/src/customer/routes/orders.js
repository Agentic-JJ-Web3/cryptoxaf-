const express = require('express');
const { z } = require('zod');
const { createQuoteOrder, claimPayment, getOrderStatus } = require('../customerOrderService');
const { createSellOrder, claimDeposit } = require('../sellOrderService');
const { submitReview } = require('../reviewService');
const { receiptUpload } = require('../../uploads/receiptUpload');

const createOrderSchema = z.object({
  xafAmount: z.number().int().positive(),
  destinationAddress: z.string().trim().min(1),
  bscConfirmed: z.boolean().optional().default(false),
});

const createSellOrderSchema = z.object({
  usdtAmount: z.string().trim().min(1, 'Enter a USDT amount'),
  chain: z.enum(['TRON', 'BSC']),
  destinationAddress: z.string().trim().min(1),
  customerMomoNumber: z.string().trim().min(1, 'Enter the MoMo number to receive your payout'),
  customerMomoNetwork: z.enum(['MTN', 'ORANGE']),
});

// multipart/form-data always parses body fields as strings — txHash is
// optional here because a receipt screenshot is a valid alternative (see
// sellOrderService.claimDeposit, which requires at least one).
const claimDepositSchema = z.object({
  txHash: z.string().trim().optional().default(''),
});

const claimPaymentSchema = z.object({
  momoTxId: z.string().trim().min(1, 'MoMo transaction ID is required'),
  // Not collected on the payment screen — the operator sees the sender's
  // number directly in their own MoMo app while verifying the transaction
  // ID. Accepted here only in case a future flow wants to pass it along.
  customerMomoNumber: z.string().trim().min(1).optional(),
});

const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(500).optional(),
});

function createOrdersRouter({ prisma, reviewRateLimit }) {
  const router = express.Router();

  router.post('/', async (req, res, next) => {
    try {
      const input = createOrderSchema.parse(req.body);
      const result = await createQuoteOrder(prisma, input);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  });

  router.post('/sell', async (req, res, next) => {
    try {
      const input = createSellOrderSchema.parse(req.body);
      const result = await createSellOrder(prisma, input);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  });

  // The reference is the bearer token for lookup — this route intentionally
  // requires no auth beyond knowing it, same trust model as the whole flow.
  router.get('/:reference', async (req, res, next) => {
    try {
      const result = await getOrderStatus(prisma, req.params.reference);
      if (!result) {
        return res.status(404).json({ error: `Order ${req.params.reference} not found` });
      }
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  router.post('/:reference/review', reviewRateLimit, async (req, res, next) => {
    try {
      const { rating, comment } = reviewSchema.parse(req.body);
      await submitReview(prisma, { reference: req.params.reference, rating, comment });
      res.status(201).json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  router.post('/:reference/claim-payment', async (req, res, next) => {
    try {
      const { momoTxId, customerMomoNumber } = claimPaymentSchema.parse(req.body);
      const order = await claimPayment(prisma, {
        reference: req.params.reference,
        momoTxId,
        customerMomoNumber,
      });
      res.json({ order });
    } catch (err) {
      next(err);
    }
  });

  router.post('/:reference/claim-deposit', receiptUpload.single('receipt'), async (req, res, next) => {
    try {
      const { txHash } = claimDepositSchema.parse(req.body);
      const order = await claimDeposit(prisma, {
        reference: req.params.reference,
        txHash,
        receiptImagePath: req.file?.filename || null,
      });
      res.json({ order });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

module.exports = { createOrdersRouter };
