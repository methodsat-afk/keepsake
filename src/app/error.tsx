'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Logo } from '@/components/ui/Logo';

/**
 * Route-level error boundary. Catches render/runtime errors in route segments
 * and shows a branded recovery screen instead of a raw Next.js crash page.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[error-boundary]', error);
  }, [error]);

  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center px-6 text-center"
      style={{ background: 'var(--background)', color: 'var(--foreground)' }}
    >
      <div className="mb-10">
        <Logo />
      </div>
      <h1 className="font-display text-3xl sm:text-4xl">Something went wrong</h1>
      <p className="mt-3 max-w-md text-lg" style={{ color: 'var(--muted)' }}>
        We hit an unexpected error. Your photos and payment are safe — please try
        again.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={reset}
          className="px-6 py-3 text-[15px] font-medium text-white transition hover:brightness-95"
          style={{ background: 'var(--deep-blue)', borderRadius: 'var(--radius-pill)' }}
        >
          Try again
        </button>
        <Link
          href="/"
          className="px-6 py-3 text-[15px] font-medium transition hover:bg-black/[0.03]"
          style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-pill)' }}
        >
          Back home
        </Link>
      </div>
    </main>
  );
}
