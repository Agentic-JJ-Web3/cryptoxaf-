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

module.exports = { InvalidAmountError, BscConfirmationRequiredError };
