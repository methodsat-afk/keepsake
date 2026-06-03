'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Logo } from '@/components/ui/Logo';
import { Button } from '@/components/ui/Button';
import { createClient } from '@/lib/supabase/client';
import { tierForBytes, formatGb } from '@/lib/pricing';
import { StorageSavings } from '@/components/download/StorageSavings';

export function DownloadContent() {
  const router = useRouter();
  const params = useSearchParams();
  const justPaid = params.get('session_id') !== null;

  const [hasPaid, setHasPaid] = useState(false);
  const [photoCount, setPhotoCount] = useState<number | null>(null);
  const [clearableBytes, setClearableBytes] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [error, setError] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const supabase = createClient();

    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return false;
      }

      const [{ data: profile }, { count }] = await Promise.all([
        supabase.from('profiles').select('has_paid, clearable_bytes').eq('id', user.id).single(),
        supabase
          .from('photos')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id),
      ]);

      setPhotoCount(count ?? 0);
      setClearableBytes((profile?.clearable_bytes as number | undefined) ?? 0);
      const paid = profile?.has_paid ?? false;
      setHasPaid(paid);
      setLoading(false);
      return paid;
    };

    load().then((paid) => {
      // Returning from Stripe: the webhook may land a beat after redirect.
      // Poll briefly so the page flips to "paid" without a manual refresh.
      if (justPaid && !paid) {
        let tries = 0;
        pollRef.current = setInterval(async () => {
          tries += 1;
          const nowPaid = await load();
          if (nowPaid || tries >= 8) {
            if (pollRef.current) clearInterval(pollRef.current);
          }
        }, 1500);
      }
    });

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [router, justPaid]);

  const handleCheckout = async () => {
    setCheckingOut(true);
    setError('');
    try {
      const res = await fetch('/api/stripe/checkout', { method: 'POST' });
      const { url } = (await res.json()) as { url?: string };
      if (url) {
        window.location.href = url;
      } else {
        setError('Could not start checkout. Please try again.');
        setCheckingOut(false);
      }
    } catch {
      setError('Network error. Please try again.');
      setCheckingOut(false);
    }
  };

  const handleDownload = () => {
    setDownloading(true);
    const a = document.createElement('a');
    a.href = '/api/download/zip';
    a.download = 'keepsake-photos.zip';
    a.click();
    setTimeout(() => setDownloading(false), 3000);
  };

  if (loading) {
    return (
      <main
        className="flex min-h-screen items-center justify-center"
        style={{ background: 'var(--background)' }}
      >
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-black/10"
          style={{ borderTopColor: 'var(--deep-blue)' }}
        />
      </main>
    );
  }

  return (
    <main
      className="relative min-h-screen px-4 py-10"
      style={{ background: 'var(--background)', color: 'var(--foreground)' }}
    >
      <div className="relative z-10 mx-auto max-w-3xl">
        <div className="mb-12">
          <Logo />
        </div>

        {/* Just-paid celebration */}
        {justPaid && hasPaid && (
          <div
            className="animate-fade-in mb-8 rounded-2xl p-5 text-center"
            style={{ border: '1px solid var(--electric-green)', background: '#f5f5f5' }}
          >
            <p className="text-lg font-medium" style={{ color: 'var(--foreground)' }}>
              🎉 Payment complete — your memories are unlocked!
            </p>
          </div>
        )}

        {/* Pending state while webhook confirms */}
        {justPaid && !hasPaid && (
          <div
            className="animate-fade-in mb-8 flex items-center justify-center gap-3 rounded-2xl p-5"
            style={{ border: '1px solid var(--border)', background: 'var(--fog-gray)' }}
          >
            <div
              className="h-4 w-4 animate-spin rounded-full border-2 border-black/10"
              style={{ borderTopColor: 'var(--deep-blue)' }}
            />
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              Confirming your payment…
            </p>
          </div>
        )}

        <h1 className="mb-2 font-display text-4xl sm:text-5xl">
          {hasPaid ? 'Your photos are ready' : 'Unlock your memories'}
        </h1>
        <p className="mb-10 text-lg" style={{ color: 'var(--muted)' }}>
          {hasPaid
            ? 'Download, browse, or revisit your rescued memories anytime.'
            : photoCount
            ? `We rescued ${photoCount} photo${photoCount === 1 ? '' : 's'} from your inbox. One payment and they’re yours forever.`
            : 'One payment. Your photos, organized and yours forever.'}
        </p>

        {/* Paywall */}
        {!hasPaid && (
          <div
            className="mb-10 overflow-hidden p-8"
            style={{
              border: '1px solid var(--border)',
              background: 'var(--fog-gray)',
              borderRadius: 'var(--radius-card)',
            }}
          >
            {/* Personalized scan-result reveal — the conversion centerpiece. */}
            <div
              className="mb-6 flex flex-wrap gap-x-8 gap-y-3 border-b pb-6"
              style={{ borderColor: 'var(--border)' }}
            >
              <div>
                <div className="font-display text-4xl" style={{ color: 'var(--deep-blue)' }}>
                  {photoCount ?? 0}
                </div>
                <p className="text-[13px]" style={{ color: 'var(--muted)' }}>
                  {photoCount === 1 ? 'photo rescued' : 'photos rescued'}
                </p>
              </div>
            </div>

            {/* Animated storage-savings visual (count-up + draining bar). */}
            <StorageSavings clearableBytes={clearableBytes} />

            <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="mb-1 flex items-baseline gap-2">
                  <span className="font-display text-5xl">
                    ${tierForBytes(clearableBytes).priceUsd}
                  </span>
                  <span className="text-sm" style={{ color: 'var(--muted)' }}>
                    one-time · no subscription
                  </span>
                </div>
                <p className="text-sm" style={{ color: 'var(--muted)' }}>
                  {clearableBytes > 0
                    ? `Unlock every photo plus cleanup of ${formatGb(clearableBytes)} of junk. Yours to keep forever.`
                    : 'Full-resolution ZIP, organized by year. Yours to keep forever.'}
                </p>
              </div>

              <div className="w-full sm:w-auto">
                <Button
                  variant="convert"
                  size="lg"
                  loading={checkingOut}
                  onClick={handleCheckout}
                  className="w-full sm:w-auto"
                >
                  {checkingOut
                    ? 'Opening checkout…'
                    : `Unlock everything — $${tierForBytes(clearableBytes).priceUsd}`}
                </Button>
              </div>
            </div>

            {error && (
              <p className="mt-4 text-sm" style={{ color: '#dc2626' }}>
                {error}
              </p>
            )}

            {/* Payment trust row */}
            <div
              className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 border-t pt-5 text-xs"
              style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
            >
              <span className="inline-flex items-center gap-1.5"> Apple Pay</span>
              <span className="inline-flex items-center gap-1.5">G Pay</span>
              <span className="inline-flex items-center gap-1.5">💳 All major cards</span>
              <span className="inline-flex items-center gap-1.5">🔒 Secured by Stripe</span>
              <span className="inline-flex items-center gap-1.5">↩️ 30-day money-back</span>
            </div>
          </div>
        )}

        {/* Delivery options */}
        <div className="grid gap-4 sm:grid-cols-3">
          <OptionCard
            enabled={hasPaid}
            icon="📦"
            title="Download ZIP"
            body="All photos organized by year."
          >
            <Button
              variant="secondary"
              size="sm"
              disabled={!hasPaid}
              loading={downloading}
              onClick={handleDownload}
              className="w-full"
            >
              Download
            </Button>
          </OptionCard>

          <OptionCard
            enabled={hasPaid}
            icon="🖼️"
            title="Private gallery"
            body="Browse your photos in Keepsake."
          >
            <Button
              variant="secondary"
              size="sm"
              disabled={!hasPaid}
              onClick={() => router.push('/gallery')}
              className="w-full"
            >
              View gallery
            </Button>
          </OptionCard>

          <OptionCard
            enabled={hasPaid}
            icon="🧹"
            title="Reclaim storage"
            body="See the junk clogging your inbox."
          >
            <Button
              variant="secondary"
              size="sm"
              disabled={!hasPaid}
              onClick={() => router.push('/cleanup')}
              className="w-full"
            >
              Clean up inbox
            </Button>
          </OptionCard>
        </div>

        {!hasPaid && (
          <p className="mt-10 text-center text-sm" style={{ color: 'var(--muted)' }}>
            Not ready yet?{' '}
            <button
              onClick={() => router.push('/gallery')}
              className="underline underline-offset-2 transition hover:opacity-80"
              style={{ color: 'var(--deep-blue)' }}
            >
              Back to your preview
            </button>
          </p>
        )}

        {hasPaid && (
          <p className="mt-10 text-center text-sm" style={{ color: 'var(--muted)' }}>
            Not happy with your photos?{' '}
            <button
              onClick={() => router.push('/refund')}
              className="underline underline-offset-2 transition hover:opacity-80"
              style={{ color: 'var(--deep-blue)' }}
            >
              30-day money-back guarantee
            </button>
          </p>
        )}
      </div>
    </main>
  );
}

function OptionCard({
  enabled,
  icon,
  title,
  body,
  children,
}: {
  enabled: boolean;
  icon: string;
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="p-6 transition"
      style={{
        border: '1px solid var(--border)',
        background: 'var(--fog-gray)',
        borderRadius: 'var(--radius-card)',
        opacity: enabled ? 1 : 0.5,
      }}
    >
      <div className="mb-4 text-3xl">{icon}</div>
      <h3 className="mb-1 font-semibold">{title}</h3>
      <p className="mb-4 text-sm" style={{ color: 'var(--muted)' }}>
        {body}
      </p>
      {children}
    </div>
  );
}
