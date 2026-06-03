import Link from 'next/link';
import { Logo } from '@/components/ui/Logo';

/** Shared chrome + typography for the Privacy and Terms pages. */
export function LegalShell({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <main
      className="relative min-h-screen overflow-hidden px-4 py-10"
      style={{ background: 'var(--background)', color: 'var(--foreground)' }}
    >
      <div className="relative z-10 mx-auto max-w-2xl">
        <div className="mb-10">
          <Logo />
        </div>

        <h1 className="mb-2 font-display text-4xl sm:text-5xl">{title}</h1>
        <p className="mb-10 text-sm" style={{ color: 'var(--muted)' }}>
          Last updated {updated}
        </p>

        <div className="legal-prose space-y-6 text-sm leading-relaxed">
          {children}
        </div>

        <div
          className="mt-12 border-t pt-6 text-sm"
          style={{ borderColor: 'var(--glass-border)', color: 'var(--muted)' }}
        >
          <Link
            href="/"
            className="underline underline-offset-2 transition hover:opacity-80"
            style={{ color: 'var(--or-light)' }}
          >
            ← Back to Keepsake
          </Link>
        </div>
      </div>
    </main>
  );
}

/** Section heading used inside legal copy. */
export function LegalSection({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2
        className="mb-2 text-lg font-semibold"
        style={{ color: 'var(--foreground)' }}
      >
        {heading}
      </h2>
      <div className="space-y-3" style={{ color: 'var(--muted)' }}>
        {children}
      </div>
    </section>
  );
}
