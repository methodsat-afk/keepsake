import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Logo } from '@/components/ui/Logo';
import { ConnectEmail } from '@/components/scan/ConnectEmail';
import { ScanProgress } from '@/components/scan/ScanProgress';

interface ScanPageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function ScanPage({ searchParams }: ScanPageProps) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // select('*') is migration-safe: it returns whatever columns exist, so this
  // page keeps working whether or not 0003_safety_caps has been applied yet.
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  const status = profile?.scan_status ?? 'idle';
  const hasPaid = profile?.has_paid ?? false;
  // Defaults mirror DEFAULT_SCAN_LIMIT; undefined pre-migration → sensible values.
  const scanLimit = (profile?.scan_limit as number | undefined) ?? 2;
  const successfulScans = (profile?.successful_scans as number | undefined) ?? 0;
  const scansLeft = Math.max(0, scanLimit - successfulScans);

  const { error: errorCode } = await searchParams;

  return (
    <main className="min-h-screen px-4 py-8" style={{ background: 'var(--background)' }}>
      <div className="mx-auto max-w-5xl">
        <div className="mb-12">
          <Logo />
        </div>

        {status === 'idle' ? (
          <ConnectEmail
            hasPaid={hasPaid}
            scansLeft={scansLeft}
            scanLimit={scanLimit}
            errorCode={errorCode}
          />
        ) : (
          <ScanProgress initialStatus={status} />
        )}
      </div>
    </main>
  );
}
