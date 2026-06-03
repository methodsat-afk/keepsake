'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Logo } from '@/components/ui/Logo';
import { Button } from '@/components/ui/Button';
import { createClient } from '@/lib/supabase/client';

type State = 'loading' | 'eligible' | 'not-eligible' | 'confirm' | 'done' | 'error';

export default function RefundPage() {
  const router = useRouter();
  const [state, setState] = useState<State>('loading');
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('has_paid')
        .eq('id', user.id)
        .single();
      setState(profile?.has_paid ? 'eligible' : 'not-eligible');
    })();
  }, [router]);

  const requestRefund = async () => {
    setWorking(true);
    setError('');
    try {
      const res = await fetch('/api/stripe/refund', { method: 'POST' });
      const body = (await res.json()) as { refunded?: boolean; error?: string };
      if (res.ok && body.refunded) {
        setState('done');
      } else {
        setError(body.error ?? 'Something went wrong. Please try again.');
        setState('error');
      }
    } catch {
      setError('Network error. Please try again.');
      setState('error');
    } finally {
      setWorking(false);
    }
  };

  return (
    <main
      className="relative min-h-screen overflow-hidden px-4 py-10"
      style={{ background: 'var(--background)', color: 'var(--foreground)' }}
    >      <div className="relative z-10 mx-auto max-w-xl">
        <div className="mb-12">
          <Logo />
        </div>

        <h1 className="mb-2 font-display text-4xl sm:text-5xl">30-day money-back guarantee</h1>
        <p className="mb-10 text-lg" style={{ color: 'var(--muted)' }}>
          Not happy with your rescued photos? Get a full refund within 30 days —
          no questions asked.
        </p>

        <div
          className="rounded-3xl p-8"
          style={{ border: '1px solid var(--glass-border)', background: 'var(--glass)' }}
        >
          {state === 'loading' && (
            <div className="flex items-center justify-center py-6">
              <div
                className="h-6 w-6 animate-spin rounded-full border-2 border-black/10"
                style={{ borderTopColor: 'var(--or)' }}
              />
            </div>
          )}

          {state === 'not-eligible' && (
            <div>
              <p className="mb-4" style={{ color: 'var(--muted)' }}>
                We don’t see an active purchase on your account, so there’s nothing
                to refund.
              </p>
              <Button variant="secondary" size="sm" onClick={() => router.push('/gallery')}>
                Back to gallery
              </Button>
            </div>
          )}

          {state === 'eligible' && (
            <div>
              <p className="mb-6" style={{ color: 'var(--muted)' }}>
                Refunding will return your <strong style={{ color: 'var(--foreground)' }}>$19</strong> to
                your original payment method and lock your downloads. You can
                re-purchase anytime.
              </p>
              <Button size="md" onClick={() => setState('confirm')}>
                Request my refund
              </Button>
            </div>
          )}

          {state === 'confirm' && (
            <div>
              <p className="mb-6" style={{ color: 'var(--foreground)' }}>
                Are you sure? This refunds your payment and removes access to your
                downloads and gallery.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button size="md" loading={working} onClick={requestRefund}>
                  {working ? 'Processing…' : 'Yes, refund my $19'}
                </Button>
                <Button
                  variant="secondary"
                  size="md"
                  disabled={working}
                  onClick={() => setState('eligible')}
                >
                  Keep my photos
                </Button>
              </div>
            </div>
          )}

          {state === 'done' && (
            <div>
              <p className="mb-2 text-lg font-semibold" style={{ color: 'var(--or-light)' }}>
                ✅ Refund issued
              </p>
              <p className="mb-6" style={{ color: 'var(--muted)' }}>
                Your $19 is on its way back — refunds usually appear in 5–10
                business days. Sorry it wasn’t the right fit.
              </p>
              <Button variant="secondary" size="sm" onClick={() => router.push('/')}>
                Back home
              </Button>
            </div>
          )}

          {state === 'error' && (
            <div>
              <p className="mb-4" style={{ color: '#dc2626' }}>
                {error}
              </p>
              <Button variant="secondary" size="sm" onClick={() => setState('eligible')}>
                Try again
              </Button>
            </div>
          )}
        </div>

        <p className="mt-8 text-center text-sm" style={{ color: 'var(--muted)' }}>
          Questions about a refund? See our{' '}
          <a href="/terms" className="underline underline-offset-2" style={{ color: 'var(--or-light)' }}>
            terms
          </a>
          .
        </p>
      </div>
    </main>
  );
}
