const { ethers } = require('ethers');
const { CHAINS } = require('../config/chains');
const { getTronWeb, getBscProvider, withTimeout, RPC_TIMEOUT_MS } = require('../validation/address');

// Read-only on-chain lookup backing the admin "verify deposit" panel for
// sell orders — see CLAUDE.md "Sell flow". This is assistive, not
// authoritative: it never transitions an order itself, only returns a
// structured readout the operator reviews before clicking confirm. Same
// category of work as validateDestinationAddress (a read-only RPC check),
// not the "automated payout" territory CLAUDE.md defers.

// Standard ERC-20/TRC-20 Transfer(address,address,uint256) event topic —
// identical across every EVM-compatible chain, Tron included.
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

class DepositVerificationUnavailableError extends Error {
  constructor(message = 'Could not check this transaction right now') {
    super(message);
    this.name = 'DepositVerificationUnavailableError';
  }
}

function normalizeHex(value) {
  return (value || '').toLowerCase().replace(/^0x/, '');
}

// TronWeb's getTransactionInfo returns log addresses/topics as raw hex
// without the "0x" (or Tron's "41" address prefix) — normalize both sides
// to bare lowercase hex before comparing, rather than trusting either
// format to already match.
async function verifyTronDeposit({ txHash, expectedRecipient, minAmountBase }) {
  const tronWeb = getTronWeb();
  let info;
  try {
    info = await withTimeout(tronWeb.trx.getTransactionInfo(txHash), RPC_TIMEOUT_MS);
  } catch {
    throw new DepositVerificationUnavailableError();
  }

  if (!info || !info.id) {
    return { found: false, matches: false, reason: 'Transaction not found on-chain yet' };
  }

  const usdtContractHex = normalizeHex(tronWeb.address.toHex(CHAINS.TRON.usdtContractAddress)).replace(/^41/, '');
  const expectedRecipientHex = normalizeHex(tronWeb.address.toHex(expectedRecipient)).replace(/^41/, '');

  const transferLog = (info.log || []).find((log) => {
    const logAddress = normalizeHex(log.address).replace(/^41/, '');
    const topic0 = normalizeHex(log.topics?.[0]);
    return logAddress === usdtContractHex && topic0 === normalizeHex(TRANSFER_TOPIC);
  });

  if (!transferLog) {
    return { found: false, matches: false, reason: 'No USDT transfer found in this transaction' };
  }

  // topics[2] is the recipient, right-padded to 32 bytes — the address is
  // the last 20 bytes (40 hex chars).
  const recipientTopic = normalizeHex(transferLog.topics[2]);
  const actualRecipientHex = recipientTopic.slice(-40);
  const actualAmountBase = BigInt(`0x${normalizeHex(transferLog.data) || '0'}`);

  const matches = actualRecipientHex === expectedRecipientHex && actualAmountBase >= minAmountBase;

  return {
    found: true,
    matches,
    actualRecipient: tronWeb.address.fromHex(`41${actualRecipientHex}`),
    actualAmountBase: actualAmountBase.toString(),
    reason: matches ? null : 'Recipient or amount does not match this order',
  };
}

async function verifyBscDeposit({ txHash, expectedRecipient, minAmountBase }) {
  const provider = getBscProvider();
  let receipt;
  try {
    receipt = await withTimeout(provider.getTransactionReceipt(txHash), RPC_TIMEOUT_MS);
  } catch {
    throw new DepositVerificationUnavailableError();
  }

  if (!receipt) {
    return { found: false, matches: false, reason: 'Transaction not found on-chain yet' };
  }

  const usdtContract = CHAINS.BSC.usdtContractAddress.toLowerCase();
  const transferLog = receipt.logs.find(
    (log) => log.address.toLowerCase() === usdtContract && log.topics?.[0]?.toLowerCase() === TRANSFER_TOPIC,
  );

  if (!transferLog) {
    return { found: false, matches: false, reason: 'No USDT transfer found in this transaction' };
  }

  const actualRecipient = ethers.getAddress(`0x${transferLog.topics[2].slice(-40)}`);
  const actualAmountBase = BigInt(transferLog.data);
  const matches =
    actualRecipient.toLowerCase() === expectedRecipient.toLowerCase() && actualAmountBase >= minAmountBase;

  return {
    found: true,
    matches,
    actualRecipient,
    actualAmountBase: actualAmountBase.toString(),
    reason: matches ? null : 'Recipient or amount does not match this order',
  };
}

// expectedRecipient: the platform's own deposit address for `chain`.
// minAmountBase: the quoted usdtAmount (BigInt, base units) — the deposit
// must cover at least this much.
async function verifyDeposit({ chain, txHash, expectedRecipient, minAmountBase }) {
  if (chain === 'TRON') {
    return verifyTronDeposit({ txHash, expectedRecipient, minAmountBase });
  }
  return verifyBscDeposit({ txHash, expectedRecipient, minAmountBase });
}

module.exports = { verifyDeposit, DepositVerificationUnavailableError };
