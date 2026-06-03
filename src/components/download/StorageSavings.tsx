'use client';

import { useEffect, useRef, useState } from 'react';
import { formatGb } from '@/lib/pricing';

/**
 * Animated "look how much storage you'll reclaim" visual for the paywall.
 * Counts the clearable-GB number up from zero and fills a before/after storage
 * bar, so the savings feels tangible. Respects prefers-reduced-motion.
 *
 * `clearableBytes` is the deterministically-measured junk size.
 * `inboxBytes` (optional) is the user's total — if absent we assume a typical
 * 15 GB Google quota so the bar still tells a believable story.
 */
const ASSUMED_TOTAL_BYTES = 15 * 1024 * 1024 * 1024; // 15 GB free Google quota

export function StorageSavings({
  clearableBytes,
  inboxBytes,
}: {
  clearableBytes: number;
  inboxBytes?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  // Lazy initializer: if the user prefers reduced motion, start fully revealed
  // (no animation) — set at mount, so we never setState synchronously in an effect.
  const [progress, setProgress] = useState<number>(() =>
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 1
      : 0
  );
  const started = useRef(false);

  const total = Math.max(inboxBytes ?? ASSUMED_TOTAL_BYTES, clearableBytes);
  // Fraction of total storage that is reclaimable junk.
  const clearableFraction = total > 0 ? Math.min(clearableBytes / total, 1) : 0;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Already revealed (reduced motion) — nothing to animate. Read from the
    // started ref / matchMedia rather than `progress` to keep deps empty.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && !started.current) {
            started.current = true;
            const DURATION = 1400;
            const start = performance.now();
            const tick = (now: number) => {
              const t = Math.min((now - start) / DURATION, 1);
              // easeOutCubic
              setProgress(1 - Math.pow(1 - t, 3));
              if (t < 1) requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
            obs.disconnect();
          }
        }
      },
      { threshold: 0.4 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  if (clearableBytes <= 0) return null;

  const animatedBytes = clearableBytes * progress;
  // Bar: starts "full" (junk占), shrinks toward the reclaimed state.
  const usedPctBefore = clearableFraction * 100;
  const usedNow = usedPctBefore * (1 - progress); // junk portion drains away

  return (
    <div
      ref={ref}
      className="mb-6 rounded-2xl p-5"
      style={{ background: '#fff', border: '1px solid var(--border)' }}
    >
      <div className="mb-3 flex items-baseline justify-between">
        <div>
          <span
            className="font-display text-4xl"
            style={{ color: 'var(--electric-green)', filter: 'saturate(0.9)' }}
          >
            {formatGb(animatedBytes)}
          </span>
          <span className="ml-2 text-[15px] font-medium" style={{ color: 'var(--foreground)' }}>
            you can reclaim
          </span>
        </div>
        <span className="text-[13px]" style={{ color: 'var(--steel-gray)' }}>
          of junk mail
        </span>
      </div>

      {/* Storage bar: the junk segment drains away as it animates */}
      <div
        className="relative h-3 w-full overflow-hidden rounded-full"
        style={{ background: '#e9e9ee' }}
        aria-hidden
      >
        {/* "kept" base fill (everything that's NOT junk) stays put */}
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ width: '100%', background: 'var(--deep-blue)', opacity: 0.18 }}
        />
        {/* the junk segment that shrinks to zero */}
        <div
          className="absolute inset-y-0 right-0 rounded-full transition-none"
          style={{
            width: `${usedNow}%`,
            background: 'linear-gradient(90deg, rgba(212,96,26,0), var(--electric-green))',
          }}
        />
      </div>

      <p className="mt-3 text-[13px]" style={{ color: 'var(--muted)' }}>
        Clearing this junk frees space you&apos;re paying Google to store —
        no more &ldquo;storage full&rdquo; nags.
      </p>
    </div>
  );
}
