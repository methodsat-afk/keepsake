'use client';

import { useEffect, useRef, useState, type ReactNode, type ElementType } from 'react';

/**
 * Reveals its children when scrolled into view. Adds `.is-visible` (see
 * globals.css `.reveal` / `.reveal-stagger`). Pure IntersectionObserver, no deps.
 * Respects prefers-reduced-motion via the CSS (animations no-op there).
 */
export function ScrollReveal({
  children,
  stagger = false,
  className = '',
  as: Tag = 'div',
  threshold = 0.15,
}: {
  children: ReactNode;
  /** Stagger direct children instead of revealing as one block. */
  stagger?: boolean;
  className?: string;
  as?: ElementType;
  threshold?: number;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // If already in view on mount (above the fold), reveal immediately.
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            obs.disconnect();
          }
        }
      },
      { threshold, rootMargin: '0px 0px -8% 0px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);

  return (
    <Tag
      ref={ref}
      className={`${stagger ? 'reveal-stagger' : 'reveal'} ${visible ? 'is-visible' : ''} ${className}`}
    >
      {children}
    </Tag>
  );
}
