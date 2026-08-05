const express = require('express');
const { z } = require('zod');
const settingsService = require('../settingsService');

const settingsSchema = z.object({
  xafUsdtRate: z.string().regex(/^\d+(\.\d{1,6})?$/, 'Use a plain decimal, up to 6 decimal places'),
  tronNetworkFeeXaf: z.number().int().nonnegative(),
  bscNetworkFeeXaf: z.number().int().nonnegative(),
  targetMarginPct: z.number().min(0).max(100),
  rateTtlSeconds: z.number().int().positive(),
  momoNetwork: z.enum(['MTN', 'ORANGE']),
  momoNumber: z.string().trim().min(1),
  momoAccountName: z.string().trim().min(1),
});

function createSettingsRouter({ prisma, requireAuth }) {
  const router = express.Router();
  router.use(requireAuth);

  router.get('/', async (req, res, next) => {
    try {
      const settings = await settingsService.getSettings(prisma);
      res.json({ settings, marginClampRangePct: settingsService.MARGIN_CLAMP_RANGE_PCT });
    } catch (err) {
      next(err);
    }
  });

  router.put('/', async (req, res, next) => {
    try {
      const data = settingsSchema.parse(req.body);
      const settings = await settingsService.updateSettings(prisma, {
        operator: req.operator,
        data,
        ip: req.ip,
        userAgent: req.get('user-agent'),
      });
      res.json({ settings });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

module.exports = { createSettingsRouter };
