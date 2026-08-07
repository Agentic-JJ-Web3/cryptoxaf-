class InvalidAmountError extends Error {
  constructor() {
    super('Enter an amount in XAF');
    this.name = 'InvalidAmountError';
  }
}

class InvalidUsdtAmountError extends Error {
  constructor() {
    super('Enter a USDT amount');
    this.name = 'InvalidUsdtAmountError';
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

class DepositProofRequiredError extends Error {
  constructor() {
    super('Enter the transaction hash or attach a screenshot of the transfer');
    this.name = 'DepositProofRequiredError';
  }
}

class InvalidReceiptFileError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InvalidReceiptFileError';
  }
}

module.exports = {
  InvalidAmountError,
  InvalidUsdtAmountError,
  BscConfirmationRequiredError,
  PlatformClosedError,
  OrderNotReviewableError,
  ReviewAlreadyExistsError,
  DepositProofRequiredError,
  InvalidReceiptFileError,
};
