// Operator-facing labels for each OrderStatus. Unlike the customer-side
// orderStage.js, operators can see the real state names — CLAUDE.md's
// "never expose the state machine" rule is specifically about
// customer-facing copy, not the tool an operator uses to run it.
const STATE_META = {
  AWAITING_PAYMENT: { label: 'Awaiting payment', color: 'var(--muted)', weight: 400, actionable: false },
  PAYMENT_CLAIMED: { label: 'Verify payment', color: 'var(--ink)', weight: 600, actionable: true },
  PAYMENT_VERIFIED: { label: 'Send USDT', color: 'var(--ink)', weight: 600, actionable: true },
  REFUND_DUE: { label: 'Refund', color: 'var(--fault)', weight: 600, actionable: true },
  COMPLETED: { label: 'Complete', color: 'var(--live)', weight: 400, actionable: false },
  REFUNDED: { label: 'Refunded', color: 'var(--muted)', weight: 400, actionable: false },
  EXPIRED: { label: 'Expired', color: 'var(--muted)', weight: 400, actionable: false },
  QUOTED: { label: 'Quoted', color: 'var(--muted)', weight: 400, actionable: false },
};

export function adminStateMeta(status) {
  return STATE_META[status] || { label: status, color: 'var(--muted)', weight: 400, actionable: false };
}

export function elapsedColor(minutes) {
  if (minutes > 20) return 'var(--fault)';
  if (minutes > 10) return 'var(--fee)';
  return 'var(--ink)';
}
