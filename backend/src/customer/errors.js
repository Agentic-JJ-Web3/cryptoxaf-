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

module.exports = { InvalidAmountError, BscConfirmationRequiredError, PlatformClosedError };
