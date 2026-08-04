// Mirrors backend/src/config/chains.js for the parts the UI needs to
// display. Decimals must match exactly — see the backend copy for why
// (18dp BSC amounts overflow a naive parse if you guess).
export const CHAIN_LABELS = {
  TRON: 'TRC-20',
  BSC: 'BEP-20',
};

export const USDT_DECIMALS = {
  TRON: 6,
  BSC: 18,
};
