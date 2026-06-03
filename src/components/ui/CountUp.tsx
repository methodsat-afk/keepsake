'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Counts up to a numeric target when scrolled into view. For stats like "500+".
 * Non-numeric values (e.g. "$19", "GBs") render as-is, instantly.
 */
export function CountUp({
  value,
  durationMs = 1400,
  className = '',
  style,
}: {
  value: string;
  durationMs?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [display, setDisplay] = useState(value);
  const started = useRef(false);

  // Parse a leading integer + suffix, e.g. "500+" → {num:500, suffix:'+'}.
  const match = value.match(/^(\d[\d,]*)(.*)$/);

  useEffect(() => {
    const el = ref.current;
    if (!el || !match) return;

    const target = parseInt(match[1].replace(/,/g, ''), 10);
    const suffix = match[2];
    // Respect reduced motion: leave the static value (already the initial state).
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const obs = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting && !started.current) {
          started.current = true;
          const start = performance.now();
          const tick = (now: number) => {
            const t = Math.min((now - start) / durationMs, 1);
            // easeOutExpo
            const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
            const current = Math.round(eased * target);
            setDisplay(current.toLocaleString() + suffix);
            if (t < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
          obs.disconnect();
        }
      }
    }, { threshold: 0.5 });

    obs.observe(el);
    return () => obs.disconnect();
  }, [value, durationMs, match]);

  return (
    <span ref={ref} className={className} style={style}>
      {match ? display : value}
    </span>
  );
}
