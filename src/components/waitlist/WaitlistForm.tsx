'use client';

import { useState } from 'react';

export function WaitlistForm({ id }: { id?: string }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState('loading');
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(data.error ?? 'Something went wrong.');
        setState('error');
        return;
      }
      setState('done');
    } catch {
      setErrorMsg('Something went wrong. Please try again.');
      setState('error');
    }
  }

  if (state === 'done') {
    return (
      <div id={id} className="flex flex-col items-center gap-2">
        <div
          className="flex items-center gap-2 text-lg font-medium"
          style={{ color: 'var(--deep-blue)' }}
        >
          <span
            className="flex h-6 w-6 items-center justify-center rounded-full text-sm"
            style={{ background: 'var(--electric-green)', color: 'var(--ink-black)' }}
          >
            ✓
          </span>
          You&apos;re on the list!
        </div>
        <p className="text-sm" style={{ color: 'var(--steel-gray)' }}>
          We&apos;ll let you know the moment Keepsake launches.
        </p>
      </div>
    );
  }

  return (
    <form id={id} onSubmit={submit} className="flex flex-col items-center gap-3 sm:flex-row">
      <input
        type="email"
        required
        placeholder="your@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full px-5 py-4 text-base outline-none sm:w-80"
        style={{
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-pill)',
          background: '#fff',
          color: 'var(--ink-black)',
        }}
      />
      <button
        type="submit"
        disabled={state === 'loading'}
        className="w-full px-8 py-4 text-[18px] font-medium transition hover:brightness-95 sm:w-auto"
        style={{
          background: 'var(--electric-green)',
          color: 'var(--ink-black)',
          borderRadius: 'var(--radius-pill)',
          opacity: state === 'loading' ? 0.7 : 1,
          cursor: state === 'loading' ? 'not-allowed' : 'pointer',
        }}
      >
        {state === 'loading' ? 'Joining…' : 'Join the waitlist'}
      </button>
      {state === 'error' && (
        <p className="w-full text-center text-sm sm:w-auto" style={{ color: '#ef4444' }}>
          {errorMsg}
        </p>
      )}
    </form>
  );
}
