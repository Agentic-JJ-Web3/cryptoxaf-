// Mirrors the transition graph enforced by the `enforce_order_state_transition`
// trigger in prisma/migrations/20260802024252_init/migration.sql. This copy
// lets the service fail fast with a clean error inside the same locked
// transaction; the trigger is the actual source of truth and the last line
// of defense against any code path that bypasses this service.
const TRANSITIONS = Object.freeze({
  QUOTED: Object.freeze(['AWAITING_PAYMENT', 'EXPIRED']),
  AWAITING_PAYMENT: Object.freeze(['PAYMENT_CLAIMED', 'EXPIRED']),
  PAYMENT_CLAIMED: Object.freeze(['PAYMENT_VERIFIED', 'REFUND_DUE']),
  PAYMENT_VERIFIED: Object.freeze(['COMPLETED']),
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
