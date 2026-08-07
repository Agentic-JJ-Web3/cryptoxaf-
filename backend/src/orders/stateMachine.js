// Mirrors the transition graph enforced by the `enforce_order_state_transition`
// trigger — originally in prisma/migrations/20260802024252_init/migration.sql,
// extended with the sell edges in 20260805190000_add_sell_flow. This copy
// lets the service fail fast with a clean error inside the same locked
// transaction; the trigger is the actual source of truth and the last line
// of defense against any code path that bypasses this service.
const TRANSITIONS = Object.freeze({
  QUOTED: Object.freeze(['AWAITING_PAYMENT', 'AWAITING_DEPOSIT', 'EXPIRED']),
  AWAITING_PAYMENT: Object.freeze(['PAYMENT_CLAIMED', 'EXPIRED']),
  PAYMENT_CLAIMED: Object.freeze(['PAYMENT_VERIFIED', 'REFUND_DUE']),
  PAYMENT_VERIFIED: Object.freeze(['COMPLETED']),
  // Sell (USDT -> XAF) — structurally parallel to the three above.
  AWAITING_DEPOSIT: Object.freeze(['DEPOSIT_CLAIMED', 'EXPIRED']),
  DEPOSIT_CLAIMED: Object.freeze(['DEPOSIT_VERIFIED', 'REFUND_DUE']),
  DEPOSIT_VERIFIED: Object.freeze(['COMPLETED']),
  REFUND_DUE: Object.freeze(['REFUNDED']),
  COMPLETED: Object.freeze([]),
  EXPIRED: Object.freeze([]),
  REFUNDED: Object.freeze([]),
});

const TERMINAL_STATUSES = new Set(['COMPLETED', 'EXPIRED', 'REFUNDED']);

function isTerminal(status) {
  return TERMINAL_STATUSES.has(status);
}

function isLegalTransition(fromStatus, toStatus) {
  return TRANSITIONS[fromStatus]?.includes(toStatus) ?? false;
}

module.exports = { TRANSITIONS, TERMINAL_STATUSES, isTerminal, isLegalTransition };
