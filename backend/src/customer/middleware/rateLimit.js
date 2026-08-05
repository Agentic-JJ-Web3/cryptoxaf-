const rateLimit = require('express-rate-limit');

// Factory, not a shared singleton — see admin/middleware/rateLimit.js for
// why: each app instance gets its own counters instead of leaking state
// across tests or processes.
function createNotifyRateLimit() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Try again later.' },
  });
}

// Same shape as createNotifyRateLimit — defense in depth. The real spam
// guard on review submission is "must be a real COMPLETED order," but a
// slow/malicious client hammering one order's review endpoint shouldn't
// get free retries against the DB unique constraint.
function createReviewRateLimit() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Try again later.' },
  });
}

module.exports = { createNotifyRateLimit, createReviewRateLimit };
