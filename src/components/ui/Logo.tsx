import Link from 'next/link';

export function Logo({ className = '' }: { className?: string }) {
  return (
    <Link href="/" className={`group flex items-center gap-2.5 ${className}`}>
      <svg
        width="30"
        height="30"
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden
        className="transition-transform duration-300 group-hover:scale-105"
      >
        {/* Monochrome ink mark with a deep-blue inner facet (OpenServ accent rule). */}
        <path d="M16 2L3 10v12l13 8 13-8V10L16 2z" fill="var(--ink-black)" />
        <path d="M16 8l-7 4.5v7L16 24l7-4.5v-7L16 8z" fill="var(--deep-blue)" />
      </svg>
      <span
        className="text-xl tracking-tight"
        style={{
          fontFamily: 'var(--font-space-grotesk), ui-sans-serif, system-ui, sans-serif',
          fontWeight: 500,
          letterSpacing: '-0.02em',
          color: 'var(--ink-black)',
        }}
      >
        Keepsake
      </span>
    </Link>
  );
}
