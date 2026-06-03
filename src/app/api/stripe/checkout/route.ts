export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe/client';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { tierForBytes, priceIdForTier } from '@/lib/pricing';

/**
 * POST /api/stripe/checkout
 * Creates a Stripe Checkout session for the one-time photo rescue payment.
 * Returns { url } to redirect the client to Stripe Checkout.
 *
 * Apple Pay / Google Pay:
 *   On Stripe-hosted Checkout (checkout.stripe.com) the wallet buttons are
 *   surfaced automatically whenever the `card` payment method is enabled and
 *   the shopper is on a supporting device (Safari + Wallet for Apple Pay,
 *   Chrome/Android for Google Pay). The checkout.stripe.com domain is
 *   pre-registered with Apple, so no domain-association file is required for
 *   this flow. We additionally enable Link and Cash App Pay for faster repeat
 *   checkout and broader coverage. Apple Pay / Google Pay must also be toggled
 *   on once in the Stripe Dashboard → Settings → Payment methods.
 */
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  const serviceClient = createServiceClient();
  const { data: profile } = await serviceClient
    .from('profiles')
    .select('stripe_customer_id, has_paid, clearable_bytes')
    .eq('id', user.id)
    .single();

  // Pick the price tier from the deterministically-measured clearable bytes.
  // Falls back to the base tier if measurement hasn't run (clearable_bytes=0).
  const tier = tierForBytes((profile?.clearable_bytes as number | undefined) ?? 0);
  const priceId = priceIdForTier(tier) ?? process.env.STRIPE_PRICE_ID!;

  // Already paid — short-circuit to the download page.
  if (profile?.has_paid) {
    return NextResponse.json({ url: `${appUrl}/download` });
  }

  // Get or create the Stripe customer so receipts + repeat purchases attach.
  let customerId = profile?.stripe_customer_id ?? undefined;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { userId: user.id },
    });
    customerId = customer.id;
    await serviceClient
      .from('profiles')
      .update({ stripe_customer_id: customerId })
      .eq('id', user.id);
  }

  let session;
  try {
    session = await stripe.checkout.sessions.create(
      {
        customer: customerId,
        // `card` carries Apple Pay + Google Pay automatically on hosted Checkout.
        // `link` and `cashapp` broaden coverage and speed up repeat checkout.
        payment_method_types: ['card', 'link', 'cashapp'],
        line_items: [{ price: priceId, quantity: 1 }],
        mode: 'payment',
        // Let shoppers apply promo codes (seasonal campaigns, win-backs, etc.).
        allow_promotion_codes: true,
        billing_address_collection: 'auto',
        // Surface a clear line on the card statement so we cut chargebacks.
        payment_intent_data: {
          description: 'Keepsake — your rescued family photos',
          statement_descriptor_suffix: 'KEEPSAKE',
          metadata: { userId: user.id, pricingTier: tier.id },
        },
        // Keep the customer's email synced on the customer object.
        customer_update: { name: 'auto', address: 'auto' },
        // Persist a clear consent + marketing-friendly receipt.
        consent_collection: { promotions: 'auto' },
        success_url: `${appUrl}/download?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appUrl}/gallery?checkout=cancelled`,
        metadata: { userId: user.id, pricingTier: tier.id },
      },
      // Idempotency: a double-clicked "Pay" button reuses the same session
      // for ~24h instead of creating duplicate charges.
      { idempotencyKey: `checkout_${user.id}_${tier.id}` }
    );
  } catch (err) {
    // `cashapp` (and occasionally `link`) can error if not activated on the
    // account. Fall back to a card-only session so checkout never hard-fails.
    console.error('[checkout] Falling back to card-only session:', err);
    session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'payment',
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      payment_intent_data: {
        description: 'Keepsake — your rescued family photos',
        statement_descriptor_suffix: 'KEEPSAKE',
        metadata: { userId: user.id, pricingTier: tier.id },
      },
      success_url: `${appUrl}/download?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/gallery?checkout=cancelled`,
      metadata: { userId: user.id, pricingTier: tier.id },
    });
  }

  return NextResponse.json({ url: session.url });
}
