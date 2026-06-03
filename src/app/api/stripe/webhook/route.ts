export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { stripe } from '@/lib/stripe/client';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * POST /api/stripe/webhook
 * Receives Stripe webhook events. On successful payment, marks the user as paid.
 * Must verify the Stripe signature to prevent spoofed events.
 *
 * We handle both synchronous (card / Apple Pay / Google Pay / Link) and
 * asynchronous (Cash App Pay and other delayed-notification methods) flows:
 *   - checkout.session.completed       → mark paid only if payment_status==='paid'
 *   - checkout.session.async_payment_succeeded → mark paid (delayed methods)
 *   - checkout.session.async_payment_failed    → log for follow-up
 */
async function markPaid(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  if (!userId) {
    console.warn('[webhook] checkout session without userId metadata:', session.id);
    return;
  }

  const supabase = createServiceClient();
  const { error } = await supabase
    .from('profiles')
    .update({
      has_paid: true,
      stripe_customer_id: (session.customer as string) ?? null,
      stripe_payment_intent_id: (session.payment_intent as string) ?? null,
      // Record which GB-based tier they actually paid for.
      pricing_tier: session.metadata?.pricingTier ?? null,
    })
    .eq('id', userId);

  if (error) {
    console.error('[webhook] Failed to mark user as paid:', error);
  } else {
    console.log(`[webhook] ✅ User ${userId} marked as paid (session ${session.id})`);
  }
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get('stripe-signature');

  if (!sig) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error('[webhook] Signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // Idempotency: Stripe retries webhooks and can deliver the same event more
  // than once. Record event.id; if the insert conflicts, we've already handled
  // it — acknowledge and skip so payments are never double-processed.
  const dedupClient = createServiceClient();
  const { error: dupError } = await dedupClient
    .from('stripe_events')
    .insert({ id: event.id, type: event.type });
  if (dupError) {
    // Unique-violation (23505) = already processed. Any other error: log but
    // still ack, since failing here would just trigger more Stripe retries.
    if (dupError.code === '23505') {
      console.log(`[webhook] Duplicate event ${event.id} ignored.`);
    } else {
      console.error('[webhook] dedup insert error (continuing):', dupError);
    }
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        // Synchronous methods land here already paid. Async methods (Cash App)
        // arrive 'unpaid' and are confirmed later via async_payment_succeeded.
        if (session.payment_status === 'paid') {
          await markPaid(session);
        } else {
          console.log(
            `[webhook] Session ${session.id} pending (${session.payment_status}); awaiting async confirmation.`
          );
        }
        break;
      }
      case 'checkout.session.async_payment_succeeded': {
        await markPaid(event.data.object);
        break;
      }
      case 'checkout.session.async_payment_failed': {
        const session = event.data.object;
        console.warn(`[webhook] Async payment failed for session ${session.id}`);
        break;
      }
      default:
        // Ignore unrelated events.
        break;
    }
  } catch (err) {
    // Never 500 back to Stripe for our own processing errors — that just
    // triggers retries. Log and acknowledge; we reconcile via the success page.
    console.error('[webhook] Handler error:', err);
  }

  return NextResponse.json({ received: true });
}
