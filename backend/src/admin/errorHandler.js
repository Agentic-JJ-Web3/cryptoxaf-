const { ZodError } = require('zod');
const { OrderNotFoundError, IllegalTransitionError } = require('../orders/orderService');
const { InvalidCredentialsError } = require('./errors');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation failed',
      details: err.issues.map((issue) => ({ path: issue.path, message: issue.message })),
    });
  }
  if (err instanceof InvalidCredentialsError) {
    return res.status(401).json({ error: err.message });
  }
  if (err instanceof OrderNotFoundError) {
    return res.status(404).json({ error: err.message });
  }
  if (err instanceof IllegalTransitionError) {
    return res.status(409).json({ error: err.message });
  }

  // eslint-disable-next-line no-console
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
}

module.exports = { errorHandler };
