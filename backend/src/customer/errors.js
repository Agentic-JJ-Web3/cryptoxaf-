class InvalidAmountError extends Error {
  constructor() {
    super('Enter an amount in XAF');
    this.name = 'InvalidAmountError';
  }
}

class BscConfirmationRequiredError extends Error {
  constructor() {
    super('Confirm the destination accepts USDT on BNB Smart Chain before continuing');
    this.name = 'BscConfirmationRequiredError';
  }
}

class PlatformClosedError extends Error {
  constructor(reopenLabel) {
    super(`We're not taking new orders right now. Reopens ${reopenLabel}.`);
    this.name = 'PlatformClosedError';
  }
}

class OrderNotReviewableError extends Error {
  constructor() {
    super('This order can only be reviewed once the swap is complete');
    this.name = 'OrderNotReviewableError';
  }
}

class ReviewAlreadyExistsError extends Error {
  constructor() {
    super('This order has already been reviewed');
    this.name = 'ReviewAlreadyExistsError';
  }
}

module.exports = {
  InvalidAmountError,
  BscConfirmationRequiredError,
  PlatformClosedError,
  OrderNotReviewableError,
  ReviewAlreadyExistsError,
};
