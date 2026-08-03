class AddressInvalidError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AddressInvalidError';
  }
}

class AddressBlockedError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AddressBlockedError';
  }
}

// The RPC call that would tell us "not a contract" failed or timed out.
// Fail closed: an unrecoverable send to a wrongly-allowed contract address
// costs more than refusing to quote for a minute.
class AddressVerificationUnavailableError extends Error {
  constructor() {
    super('Could not verify this address right now. Try again shortly.');
    this.name = 'AddressVerificationUnavailableError';
  }
}

module.exports = { AddressInvalidError, AddressBlockedError, AddressVerificationUnavailableError };
