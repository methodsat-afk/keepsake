/**
 * Pure refund-eligibility logic, extracted from the refund route so it can be
 * exhaustively unit-tested without mocking Stripe/Supabase. The route stays a
 * thin shell that fetches data and calls this.
 */

export const REFUND_WINDOW_DAYS = 30;

export interface RefundContext {
  /** Does the profile currently show as paid? */
  hasPaid: boolean;
  /** Stripe payment intent id on the profile (null if none). */
  paymentIntentId: string | null;
  /** PaymentIntent.created (unix seconds), or null if PI not retrievable. */
  piCreatedUnix: number | null;
  /** PaymentIntent.status, e.g. 'succeeded'. */
  piStatus: string | null;
  /** Whether the underlying charge is already refunded. */
  alreadyRefunded: boolean;
  /** Current time (unix seconds) — injectable for deterministic tests. */
  nowUnix: number;
}

export type RefundDecision =
  | { action: 'reject'; status: number; reason: string }
  | { action: 'already_refunded' } // revoke access, report success
  | { action: 'refund' }; // issue the refund

/**
 * Decide what to do with a refund request. Pure — no I/O.
 */
export function decideRefund(ctx: RefundContext): RefundDecision {
  if (!ctx.hasPaid || !ctx.paymentIntentId) {
    return { action: 'reject', status: 400, reason: 'No active payment found to refund.' };
  }

  if (ctx.piCreatedUnix == null) {
    return { action: 'reject', status: 422, reason: 'This payment cannot be refunded.' };
  }

  const ageDays = (ctx.nowUnix - ctx.piCreatedUnix) / 86_400;
  if (ageDays > REFUND_WINDOW_DAYS) {
    return {
      action: 'reject',
      status: 422,
      reason: `Your purchase is outside the ${REFUND_WINDOW_DAYS}-day money-back window.`,
    };
  }

  if (ctx.piStatus !== 'succeeded') {
    return { action: 'reject', status: 422, reason: 'This payment cannot be refunded.' };
  }

  if (ctx.alreadyRefunded) {
    return { action: 'already_refunded' };
  }

  return { action: 'refund' };
}
