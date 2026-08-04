// Maps the state machine's internal statuses to the four customer-facing
// buckets CLAUDE.md specifies — the API returns the real status (same
// backend/frontend split as the admin side), this is where it becomes
// copy a customer would recognize instead of the machine's own names.
export function stageFromStatus(status) {
  switch (status) {
    case 'AWAITING_PAYMENT':
      return 'waiting';
    case 'PAYMENT_CLAIMED':
    case 'PAYMENT_VERIFIED':
      return 'checking';
    case 'COMPLETED':
      return 'sent';
    case 'REFUND_DUE':
    case 'REFUNDED':
      return 'refund';
    case 'EXPIRED':
      return 'expired';
    default:
      return 'checking';
  }
}
