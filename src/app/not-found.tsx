import Link from 'next/link';
import { Logo } from '@/components/ui/Logo';

export default function NotFound() {
  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center px-6 text-center"
      style={{ background: 'var(--background)', color: 'var(--foreground)' }}
    >
      <div className="mb-10">
        <Logo />
      </div>
      <p className="font-display text-7xl" style={{ color: 'var(--deep-blue)' }}>
        404
      </p>
      <h1 className="mt-4 font-display text-3xl sm:text-4xl">
        We couldn&apos;t find that page
      </h1>
      <p className="mt-3 max-w-md text-lg" style={{ color: 'var(--muted)' }}>
        The link may be broken or the page may have moved.
      </p>
      <Link
        href="/"
        className="mt-8 inline-block px-6 py-3 text-[15px] font-medium text-white transition hover:brightness-95"
        style={{ background: 'var(--deep-blue)', borderRadius: 'var(--radius-pill)' }}
      >
        Back to Keepsake
      </Link>
    </main>
  );
}
