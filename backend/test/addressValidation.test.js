// These tests hit the real public Tron/BSC RPC endpoints (same as the
// address validation module itself does) — consistent with the rest of
// this suite running against a real Postgres rather than mocks. They
// require outbound network access.
const { validateDestinationAddress, detectChainAndShapeError } = require('../src/validation/address');
const { AddressInvalidError, AddressBlockedError } = require('../src/validation/errors');

jest.setTimeout(30000);

describe('detectChainAndShapeError — shape only, no network', () => {
  test('detects a Tron address', () => {
    expect(detectChainAndShapeError('TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE').chain).toBe('TRON');
  });

  test('detects an EVM address', () => {
    expect(detectChainAndShapeError('0x9F3c2e7a1B4D8C6F0A2e5D9B3C7f1A4e8D2B6c0f').chain).toBe('BSC');
  });

  test('gives a specific message for a truncated Tron address', () => {
    const result = detectChainAndShapeError('TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLS');
    expect(result.chain).toBeNull();
    expect(result.error).toMatch(/34 characters/);
  });

  test('gives a specific message for a short EVM address', () => {
    const result = detectChainAndShapeError('0x9F3c2e7a1B4D8C6F0A2e5D9B3C7f1A4e8D2B6c0');
    expect(result.chain).toBeNull();
    expect(result.error).toMatch(/40 hex characters/);
  });

  test('rejects an empty address', () => {
    expect(detectChainAndShapeError('').chain).toBeNull();
    expect(detectChainAndShapeError('   ').chain).toBeNull();
  });
});

describe('validateDestinationAddress — full server-side validation', () => {
  test('accepts a real Tron wallet address', async () => {
    const result = await validateDestinationAddress('TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE');
    expect(result.chain).toBe('TRON');
    expect(result.head).toBe('TQn9Y2');
    expect(result.tail).toBe('KcbLSE');
  });

  test('accepts a real BSC wallet address and normalizes to checksummed form', async () => {
    const result = await validateDestinationAddress('0x9f3c2e7a1b4d8c6f0a2e5d9b3c7f1a4e8d2b6c0f');
    expect(result.chain).toBe('BSC');
    expect(result.normalizedAddress).toBe('0x9F3c2e7a1B4D8C6F0A2e5D9B3C7f1A4e8D2B6c0f');
  });

  test('rejects a malformed address', async () => {
    await expect(validateDestinationAddress('not-an-address')).rejects.toThrow(AddressInvalidError);
  });

  test('rejects a Tron address with a bad checksum (single flipped character)', async () => {
    // Same shape as a valid address, wrong trailing character.
    await expect(validateDestinationAddress('TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSF')).rejects.toThrow(
      AddressInvalidError,
    );
  });

  test('rejects an EVM address with a bad EIP-55 checksum', async () => {
    // Valid shape, deliberately wrong casing relative to the real checksum.
    await expect(validateDestinationAddress('0x9F3c2E7a1B4d8C6f0A2e5D9b3C7f1A4e8D2b6C0f')).rejects.toThrow(
      AddressInvalidError,
    );
  });

  test('blocks the Tron USDT contract address outright', async () => {
    await expect(validateDestinationAddress('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t')).rejects.toThrow(
      AddressBlockedError,
    );
  });

  test('blocks the BSC USDT contract address outright', async () => {
    await expect(validateDestinationAddress('0x55d398326f99059fF775485246999027B3197955')).rejects.toThrow(
      AddressBlockedError,
    );
  });
});
