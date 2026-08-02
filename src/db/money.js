// usdtAmount is stored in Postgres as NUMERIC(38,0), not BIGINT: BSC's
// 18-decimal USDT overflows a native int8 (max ~9.22e18, i.e. ~9.2 USDT)
// for any order past pocket change. NUMERIC(38,0) is still an exact,
// float-free integer column — just wide enough to hold it. Prisma maps
// NUMERIC to its Decimal type, so we convert at the service boundary to
// keep BigInt as the one representation the rest of the app deals with.
function decimalToBigInt(decimal) {
  return BigInt(decimal.toFixed(0));
}

module.exports = { decimalToBigInt };
