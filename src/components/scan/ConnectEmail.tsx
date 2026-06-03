'use client';

import { useState } from 'react';

const providers = [
  {
    id: 'google',
    name: 'Gmail',
    description: 'Connect your Google account',
    color: 'from-red-500/20 to-orange-500/20',
    border: 'border-red-500/30',
    icon: (
      <svg className="h-8 w-8" viewBox="0 0 24 24" aria-hidden>
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
      </svg>
    ),
  },
  {
    id: 'microsoft',
    name: 'Outlook',
    description: 'Connect your Microsoft account',
    color: 'from-blue-500/20 to-cyan-500/20',
    border: 'border-blue-500/30',
    icon: (
      <svg className="h-8 w-8" viewBox="0 0 24 24" aria-hidden>
        <path d="M11.5 2L2 6.5v11L11.5 22 21 17.5v-11L11.5 2z" fill="#0078D4" />
        <path d="M11.5 2v20L2 17.5v-11L11.5 2z" fill="#50E6FF" opacity="0.6" />
      </svg>
    ),
  },
  {
    id: 'microsoft',
    name: 'Hotmail',
    description: 'Connect your Hotmail account',
    color: 'from-sky-500/20 to-blue-500/20',
    border: 'border-sky-500/30',
    icon: (
      <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect width="24" height="24" rx="4" fill="#0078D4" />
        <path d="M5 7h14v10H5z" fill="white" opacity="0.9" />
        <path d="M5 7l7 6 7-6" stroke="#0078D4" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    id: 'yahoo',
    name: 'Yahoo Mail',
    description: 'Connect your Yahoo account',
    color: 'from-purple-500/20 to-violet-500/20',
    border: 'border-purple-500/30',
    icon: (
      <svg className="h-8 w-8" viewBox="0 0 24 24" aria-hidden>
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill="#6001D2" />
        <text x="6" y="17" fontFamily="Arial" fontSize="12" fontWeight="bold" fill="white">Y!</text>
      </svg>
    ),
  },
];

interface ConnectEmailProps {
  hasPaid?: boolean;
  scansLeft?: number;
  scanLimit?: number;
  errorCode?: string;
}

export function ConnectEmail({
  hasPaid = false,
  scansLeft = 2,
  scanLimit = 2,
  errorCode,
}: ConnectEmailProps) {
  const [loading, setLoading] = useState<string | null>(null);

  // Free users who have used all their scans can't start another.
  const outOfScans = !hasPaid && scansLeft <= 0;

  const connect = (providerId: string) => {
    if (outOfScans) return;
    setLoading(providerId);
    // Gmail uses our direct Google OAuth route (no Nylas middleman)
    if (providerId === 'google') {
      window.location.assign('/api/auth/google');
    } else {
      window.location.assign(`/api/auth/nylas?provider=${providerId}`);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-10 text-center">
        <h2 className="mb-3 font-display text-4xl">
          Connect your inbox
        </h2>
        <p className="text-black/55">
          We scan read-only and never store your emails — only the photos we find.
        </p>

        {/* Scan allowance pill (free users only) */}
        {!hasPaid && (
          <div
            className="mt-5 inline-flex items-center gap-2 px-4 py-1.5 text-[13px]"
            style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-pill)', color: 'var(--graphite)' }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: scansLeft > 0 ? 'var(--deep-blue)' : 'var(--steel-gray)' }}
            />
            {scansLeft > 0
              ? `${scansLeft} of ${scanLimit} free ${scanLimit === 1 ? 'scan' : 'scans'} left`
              : 'No free scans left'}
          </div>
        )}

        {/* Error from a blocked scan-start */}
        {errorCode === 'scan_limit' && (
          <p className="mt-4 text-sm" style={{ color: '#dc2626' }}>
            You&apos;ve used all your free scans. Unlock Keepsake to keep going.
          </p>
        )}
        {errorCode === 'auth_failed' && (
          <p className="mt-4 text-sm" style={{ color: '#dc2626' }}>
            We couldn&apos;t connect that account. Please try again.
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {providers.map((provider, i) => (
          <button
            key={`${provider.id}-${i}`}
            onClick={() => connect(provider.id)}
            disabled={loading !== null || outOfScans}
            className={`group relative overflow-hidden rounded-2xl border border-black/10 bg-[#f5f5f5] p-6 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl disabled:opacity-60 disabled:cursor-not-allowed`}
          >
            <div className="mb-4">{provider.icon}</div>
            <h3 className="mb-1 text-lg font-semibold text-black">
              {provider.name}
            </h3>
            <p className="text-sm text-black/55">{provider.description}</p>
            {loading === provider.id && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              </div>
            )}
          </button>
        ))}
      </div>

      {outOfScans ? (
        <div className="mt-8 text-center">
          <a
            href="/download"
            className="inline-block px-6 py-3 text-[15px] font-medium transition hover:brightness-95"
            style={{ background: 'var(--electric-green)', color: 'var(--ink-black)', borderRadius: 'var(--radius-pill)' }}
          >
            Unlock Keepsake — $19
          </a>
        </div>
      ) : (
        <p className="mt-8 text-center text-xs text-[#a6a6a6]">
          OAuth secured · Read-only access · Disconnect anytime
        </p>
      )}
    </div>
  );
}
