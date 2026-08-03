const rateLimit = require('express-rate-limit');

// Factory, not a shared singleton: each createApp() call (each test, each
// server process) gets its own counters instead of leaking state across
// app instances.
function createLoginRateLimit() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many login attempts. Try again later.' },
  });
}

module.exports = { createLoginRateLimit };
