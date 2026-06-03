import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { Logo } from '@/components/ui/Logo';
import { CleanupReview } from '@/components/cleanup/CleanupReview';

export default async function CleanupPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const serviceClient = createServiceClient();
  const { data: profile } = await serviceClient
    .from('profiles')
    .select('has_paid')
    .eq('id', user.id)
    .single();

  // Cleanup is a paid feature; unpaid users are sent to unlock first.
  if (!profile?.has_paid) redirect('/download');

  return (
    <main className="min-h-screen px-4 py-8" style={{ background: 'var(--background)' }}>
      <div className="mx-auto max-w-4xl">
        <div className="mb-10 flex items-center justify-between">
          <Logo />
          <a
            href="/gallery"
            className="text-sm transition hover:text-black"
            style={{ color: 'var(--steel-gray)' }}
          >
            Back to gallery
          </a>
        </div>

        <div className="mb-8">
          <h1 className="font-display text-4xl sm:text-5xl" style={{ color: 'var(--foreground)' }}>
            Reclaim your storage
          </h1>
          <p className="mt-2 text-lg" style={{ color: 'var(--muted)' }}>
            See the junk clogging your inbox. You decide what goes — everything is
            recoverable from Trash for 30 days.
          </p>
        </div>

        <CleanupReview />
      </div>
    </main>
  );
}
