import Stripe from 'stripe';

let _stripe: Stripe | null = null;

/** Lazy singleton Stripe client — only instantiated on first use, never at build time. */
export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2026-04-22.dahlia',
    });
  }
  return _stripe;
}

/** Convenience re-export for code that imports `stripe` directly. */
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return getStripe()[prop as keyof Stripe];
  },
});
