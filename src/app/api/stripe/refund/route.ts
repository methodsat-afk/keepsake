export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe/client';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { decideRefund } from '@/lib/refund-policy';

/**
 * POST /api/stripe/refund
 * Self-service refund for the advertised 30-day money-back guarantee.
 *
 * Flow: verify the signed-in user actually paid, confirm the original payment
 * is still inside the 30-day window, issue the Stripe refund, then revoke
 * access (has_paid = false) so the gallery/download lock back down.
 *
 * Note: digital goods can be downloaded before a refund, so a high-trust
 * "instant" refund like this can be abused. It matches the unconditional
 * guarantee we advertise; add manual review here later if abuse appears.
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const serviceClient = createServiceClient();
  const { data: profile } = await serviceClient
    .from('profiles')
    .select('has_paid, stripe_payment_intent_id')
    .eq('id', user.id)
    .single();

  try {
    // Retrieve the PI (if any) so the pure policy can decide. Expand latest_charge
    // to detect an already-refunded charge.
    let piCreatedUnix: number | null = null;
    let piStatus: string | null = null;
    let alreadyRefunded = false;

    if (profile?.has_paid && profile.stripe_payment_intent_id) {
      const pi = await stripe.paymentIntents.retrieve(
        profile.stripe_payment_intent_id,
        { expand: ['latest_charge'] }
      );
      piCreatedUnix = pi.created;
      piStatus = pi.status;
      const charge = pi.latest_charge;
      alreadyRefunded = !!(charge && typeof charge !== 'string' && charge.refunded);
    }

    const decision = decideRefund({
      hasPaid: profile?.has_paid ?? false,
      paymentIntentId: profile?.stripe_payment_intent_id ?? null,
      piCreatedUnix,
      piStatus,
      alreadyRefunded,
      nowUnix: Math.floor(Date.now() / 1000),
    });

    if (decision.action === 'reject') {
      return NextResponse.json({ error: decision.reason }, { status: decision.status });
    }

    if (decision.action === 'already_refunded') {
      // Make sure access is revoked, then report success (no second refund).
      await serviceClient.from('profiles').update({ has_paid: false }).eq('id', user.id);
      return NextResponse.json({ refunded: true, alreadyRefunded: true });
    }

    // decision.action === 'refund' — issue it (idempotent per payment intent).
    await stripe.refunds.create(
      {
        payment_intent: profile!.stripe_payment_intent_id!,
        reason: 'requested_by_customer',
        metadata: { userId: user.id },
      },
      { idempotencyKey: `refund_${profile!.stripe_payment_intent_id}` }
    );

    // Revoke access now that the money is going back.
    await serviceClient.from('profiles').update({ has_paid: false }).eq('id', user.id);

    return NextResponse.json({ refunded: true });
  } catch (err) {
    console.error('[refund] Failed to process refund:', err);
    return NextResponse.json(
      { error: 'We could not process the refund. Please contact support.' },
      { status: 500 }
    );
  }
}
