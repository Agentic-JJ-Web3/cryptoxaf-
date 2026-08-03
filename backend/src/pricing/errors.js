class RateUnavailableError extends Error {
  constructor(reason = 'Rate feed is unavailable') {
    super(reason);
    this.name = 'RateUnavailableError';
  }
}

class AmountTooSmallError extends Error {
  constructor() {
    super('That amount is too small to cover the network fee');
    this.name = 'AmountTooSmallError';
  }
}

module.exports = { RateUnavailableError, AmountTooSmallError };
