export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

/**
 * POST /api/cleanup/cancel
 * Kill switch: marks the user's latest in-progress cleanup run as 'cancelled'.
 * The classify workers check is_run_cancelled() and bail, so any remaining
 * fan-out stops making LLM calls. Idempotent.
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

  // Cancel any of the user's runs that are still working.
  const { data: cancelled, error } = await serviceClient
    .from('cleanup_runs')
    .update({ status: 'cancelled' })
    .eq('user_id', user.id)
    .in('status', ['pending', 'scanning'])
    .select('id');

  if (error) {
    console.error('[cleanup/cancel] failed:', error);
    return NextResponse.json({ error: 'Could not cancel.' }, { status: 500 });
  }

  return NextResponse.json({ cancelled: cancelled?.length ?? 0 });
}
