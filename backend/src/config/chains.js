// Per-chain USDT config. Read decimals from here — never inline a literal.
// Tron TRC-20 USDT is 6dp; Binance-Peg USDT on BSC is 18dp. Mixing them up
// sends a trillionth (or a trillion times) the intended amount.
const CHAINS = Object.freeze({
  TRON: Object.freeze({
    key: 'TRON',
    label: 'Tron (TRC-20)',
    usdtDecimals: 6,
    // Official TRC-20 USDT contract. Sending here (instead of *to* an
    // address the contract governs) is unrecoverable — block outright.
    usdtContractAddress: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
    rpcUrl: process.env.TRON_RPC_URL || 'https://api.trongrid.io',
    explorerTxUrl: (txHash) => `https://tronscan.org/#/transaction/${txHash}`,
  }),
  BSC: Object.freeze({
    key: 'BSC',
    label: 'BNB Smart Chain (BEP-20)',
    usdtDecimals: 18,
    // Official Binance-Peg USDT (BEP-20) contract.
    usdtContractAddress: '0x55d398326f99059fF775485246999027B3197955',
    rpcUrl: process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org',
    explorerTxUrl: (txHash) => `https://bscscan.com/tx/${txHash}`,
  }),
});

function usdtDecimalsFor(chain) {
  const config = CHAINS[chain];
  if (!config) {
    throw new Error(`Unknown chain: ${chain}`);
  }
  return config.usdtDecimals;
}

// Converts a human USDT amount (integer or decimal string/number, e.g.
// "12.5") to base units for `chain` without ever passing through a float.
function toUsdtBaseUnits(chain, humanAmount) {
  const decimals = usdtDecimalsFor(chain);
  const [whole, fraction = ''] = String(humanAmount).split('.');
  if (fraction.length > decimals) {
    throw new Error(`${humanAmount} has more precision than ${chain} supports (${decimals}dp)`);
  }
  const paddedFraction = fraction.padEnd(decimals, '0');
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(paddedFraction || '0');
}

module.exports = { CHAINS, usdtDecimalsFor, toUsdtBaseUnits };
