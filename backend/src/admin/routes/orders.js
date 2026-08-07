const path = require('path');
const express = require('express');
const { z } = require('zod');
const orderAdminService = require('../orderAdminService');
const { RECEIPTS_DIR } = require('../../uploads/receiptUpload');

const rejectSchema = z.object({ reason: z.string().trim().min(1, 'reason is required') });
const completeSchema = z.object({ payoutReference: z.string().trim().min(1, 'payoutReference is required') });
const refundSchema = z.object({ note: z.string().trim().optional() });

function serializeForResponse(order) {
  return { ...order, usdtAmount: order.usdtAmount.toString() };
}

// Ignores an unparseable date rather than erroring — this only filters a
// history view, not a financial write path.
function parseDateOrUndefined(value) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
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

  // Must be registered before /:reference — otherwise Express would match
  // "history" itself as a reference param and this route would never fire.
  router.get('/history', async (req, res, next) => {
    try {
      const { direction, status, dateFrom, dateTo, limit, offset } = req.query;
      const result = await orderAdminService.listHistory(prisma, {
        direction: direction || undefined,
        status: status || undefined,
        dateFrom: parseDateOrUndefined(dateFrom),
        dateTo: parseDateOrUndefined(dateTo),
        limit: limit ? Number(limit) : undefined,
        offset: offset ? Number(offset) : undefined,
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

  // Read-only — never transitions the order, just runs the on-chain lookup
  // and returns what it found for the operator to review.
  router.post('/:reference/check-deposit', async (req, res, next) => {
    try {
      const result = await orderAdminService.checkDeposit(prisma, { reference: req.params.reference });
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  router.post('/:reference/verify-deposit', async (req, res, next) => {
    try {
      const order = await orderAdminService.verifySellDeposit(prisma, {
        reference: req.params.reference,
        operator: req.operator,
      });
      res.json({ order: serializeForResponse(order) });
    } catch (err) {
      next(err);
    }
  });

  router.post('/:reference/reject-deposit', async (req, res, next) => {
    try {
      const { reason } = rejectSchema.parse(req.body);
      const order = await orderAdminService.rejectDeposit(prisma, {
        reference: req.params.reference,
        operator: req.operator,
        reason,
      });
      res.json({ order: serializeForResponse(order) });
    } catch (err) {
      next(err);
    }
  });

  router.post('/:reference/complete-sell', async (req, res, next) => {
    try {
      const { payoutReference } = completeSchema.parse(req.body);
      const order = await orderAdminService.completeSellOrder(prisma, {
        reference: req.params.reference,
        operator: req.operator,
        payoutReference,
      });
      res.json({ order: serializeForResponse(order) });
    } catch (err) {
      next(err);
    }
  });

  // The only path a receipt screenshot is ever served through — never a
  // public static mount. path.basename strips any directory components a
  // stored value could theoretically contain, so this can never escape
  // RECEIPTS_DIR regardless of what's in the database.
  router.get('/:reference/receipt', async (req, res, next) => {
    try {
      const order = await orderAdminService.getOrderDetail(prisma, req.params.reference);
      if (!order || !order.depositReceiptImagePath) {
        return res.status(404).json({ error: 'No receipt for this order' });
      }
      res.sendFile(path.join(RECEIPTS_DIR, path.basename(order.depositReceiptImagePath)));
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
