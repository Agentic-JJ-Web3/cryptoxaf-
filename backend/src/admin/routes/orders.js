const express = require('express');
const { z } = require('zod');
const orderAdminService = require('../orderAdminService');

const rejectSchema = z.object({ reason: z.string().trim().min(1, 'reason is required') });
const completeSchema = z.object({ payoutReference: z.string().trim().min(1, 'payoutReference is required') });
const refundSchema = z.object({ note: z.string().trim().optional() });

function serializeForResponse(order) {
  return { ...order, usdtAmount: order.usdtAmount.toString() };
}

function createOrdersRouter({ prisma, requireAuth }) {
  const router = express.Router();
  router.use(requireAuth);

  router.get('/', async (req, res, next) => {
    try {
      const result = await orderAdminService.listQueue(prisma, {
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        offset: req.query.offset ? Number(req.query.offset) : undefined,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  router.get('/:reference', async (req, res, next) => {
    try {
      const order = await orderAdminService.getOrderDetail(prisma, req.params.reference);
      if (!order) {
        return res.status(404).json({ error: `Order ${req.params.reference} not found` });
      }
      res.json({ order });
    } catch (err) {
      next(err);
    }
  });

  router.post('/:reference/verify-payment', async (req, res, next) => {
    try {
      const order = await orderAdminService.verifyPayment(prisma, {
        reference: req.params.reference,
        operator: req.operator,
      });
      res.json({ order: serializeForResponse(order) });
    } catch (err) {
      next(err);
    }
  });

  router.post('/:reference/reject-payment', async (req, res, next) => {
    try {
      const { reason } = rejectSchema.parse(req.body);
      const order = await orderAdminService.rejectPayment(prisma, {
        reference: req.params.reference,
        operator: req.operator,
        reason,
      });
      res.json({ order: serializeForResponse(order) });
    } catch (err) {
      next(err);
    }
  });

  router.post('/:reference/complete', async (req, res, next) => {
    try {
      const { payoutReference } = completeSchema.parse(req.body);
      const order = await orderAdminService.completeOrder(prisma, {
        reference: req.params.reference,
        operator: req.operator,
        payoutReference,
      });
      res.json({ order: serializeForResponse(order) });
    } catch (err) {
      next(err);
    }
  });

  router.post('/:reference/refund', async (req, res, next) => {
    try {
      const { note } = refundSchema.parse(req.body);
      const order = await orderAdminService.refundOrder(prisma, {
        reference: req.params.reference,
        operator: req.operator,
        note,
      });
      res.json({ order: serializeForResponse(order) });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

module.exports = { createOrdersRouter };
