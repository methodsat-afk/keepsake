import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { Logo } from '@/components/ui/Logo';
import { PhotoGrid } from '@/components/gallery/PhotoGrid';
import { CheckoutCancelledBanner } from '@/components/gallery/CheckoutCancelledBanner';

export default async function GalleryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const serviceClient = createServiceClient();

  const [{ data: profile }, { data: photos }] = await Promise.all([
    serviceClient.from('profiles').select('has_paid').eq('id', user.id).single(),
    serviceClient
      .from('photos')
      .select('*')
      .eq('user_id', user.id)
      .order('email_date', { ascending: false }),
  ]);

  const count = photos?.length ?? 0;

  return (
    <main className="min-h-screen px-4 py-8 pb-24" style={{ background: 'var(--background)' }}>
      <div className="mx-auto max-w-6xl">

        {/* Header */}
        <div className="mb-10 flex items-center justify-between">
          <Logo />
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            {count} {count === 1 ? 'photo' : 'photos'} rescued
          </p>
        </div>

        <Suspense fallback={null}>
          <CheckoutCancelledBanner />
        </Suspense>

        {/* Title block */}
        <div className="mb-8">
          <h1 className="font-display text-4xl sm:text-5xl" style={{ color: 'var(--foreground)' }}>
            Your rescued memories
          </h1>
          {!profile?.has_paid && count > 0 && (
            <p className="mt-2 text-sm" style={{ color: 'var(--muted)' }}>
              Previewing {Math.min(2, count)} of {count} photos —{' '}
              <a href="/download" className="underline underline-offset-2 transition hover:opacity-80" style={{ color: 'var(--or-light)' }}>
                unlock all for $19
              </a>
            </p>
          )}
          {profile?.has_paid && count > 0 && (
            <p className="mt-2 text-sm" style={{ color: 'var(--muted)' }}>
              All {count} photos are yours —{' '}
              <a href="/download" className="underline underline-offset-2 transition hover:opacity-80" style={{ color: 'var(--or-light)' }}>
                download ZIP
              </a>
            </p>
          )}
        </div>

        <PhotoGrid photos={photos ?? []} hasPaid={profile?.has_paid ?? false} />
      </div>
    </main>
  );
}
