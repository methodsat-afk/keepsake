'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';

/**
 * Shown when Stripe sends the shopper back to /gallery?checkout=cancelled
 * (the cancel_url set on the Checkout Session). Gives a gentle nudge to retry
 * instead of leaving them staring at a blurred grid with no explanation.
 */
export function CheckoutCancelledBanner() {
  const params = useSearchParams();
  const cancelled = params.get('checkout') === 'cancelled';
  const [dismissed, setDismissed] = useState(false);

  if (!cancelled || dismissed) return null;

  return (
    <div
      className="animate-fade-in mb-8 flex items-center justify-between gap-4 rounded-2xl p-4"
      style={{ border: '1px solid var(--border)', background: 'var(--glass)' }}
    >
      <div className="flex items-center gap-3">
        <span aria-hidden className="text-xl">↩️</span>
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
            Checkout cancelled — no charge was made.
          </p>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            Your memories are still here whenever you’re ready.{' '}
            <a
              href="/download"
              className="underline underline-offset-2 transition hover:opacity-80"
              style={{ color: 'var(--or-light)' }}
            >
              Try again
            </a>
          </p>
        </div>
      </div>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="rounded-full px-2 py-1 text-sm transition hover:opacity-70"
        style={{ color: 'var(--muted)' }}
      >
        ✕
      </button>
    </div>
  );
}
