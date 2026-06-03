export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { inngest } from '@/lib/inngest/client';

/**
 * POST /api/cleanup/scan
 * Starts a DRY-RUN inbox cleanup scan: finds junk candidates and classifies them
 * into tiers. Non-destructive — nothing is trashed here. Gated on a paid account
 * so memories are rescued first. See docs/inbox-cleanup-design.md §5 & §7.
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const serviceClient = createServiceClient();

  // Cleanup is a paid feature; it also guarantees photos were rescued first.
  const { data: profile } = await serviceClient
    .from('profiles')
    .select('has_paid')
    .eq('id', user.id)
    .single();

  if (!profile?.has_paid) {
    return NextResponse.json({ error: 'Payment required' }, { status: 402 });
  }

  // Reuse the Gmail tokens captured by the most recent scan.
  const { data: scan } = await serviceClient
    .from('scans')
    .select('gmail_access_token, gmail_refresh_token')
    .eq('user_id', user.id)
    .order('started_at', { ascending: false })
    .limit(1)
    .single();

  if (!scan?.gmail_access_token) {
    return NextResponse.json(
      { error: 'No connected inbox found. Reconnect your email and try again.' },
      { status: 409 }
    );
  }

  // Create the run row.
  const { data: run, error } = await serviceClient
    .from('cleanup_runs')
    .insert({ user_id: user.id, status: 'pending' })
    .select()
    .single();

  if (error || !run) {
    console.error('[cleanup/scan] Failed to create cleanup_run:', error);
    return NextResponse.json({ error: 'Could not start cleanup. Please try again.' }, { status: 500 });
  }

  await inngest.send({
    name: 'keepsake/cleanup.start',
    data: {
      userId: user.id,
      runId: run.id,
      accessToken: scan.gmail_access_token,
      refreshToken: scan.gmail_refresh_token,
    },
  });

  return NextResponse.json({ runId: run.id, status: run.status });
}
