export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import type { CleanupItem } from '@/types';

/**
 * GET /api/cleanup/run
 * Returns the user's latest cleanup run plus its candidate items grouped by
 * sender, for the review UI. Read-only. See docs/inbox-cleanup-design.md §7.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const serviceClient = createServiceClient();

  const { data: run } = await serviceClient
    .from('cleanup_runs')
    .select('*')
    .eq('user_id', user.id)
    .order('started_at', { ascending: false })
    .limit(1)
    .single();

  if (!run) {
    return NextResponse.json({ run: null, groups: [] });
  }

  const { data: items } = await serviceClient
    .from('cleanup_items')
    .select('*')
    .eq('run_id', run.id)
    .order('size_estimate', { ascending: false });

  // Group deletable candidates (auto + review) by sender for the UI. Protected
  // items are returned separately so the UI can reassure ("we'll never touch these").
  const deletable = (items ?? []).filter((i: CleanupItem) => i.tier !== 'protected');
  const protectedCount = (items ?? []).length - deletable.length;

  const bySender = new Map<
    string,
    { sender: string; senderName: string | null; count: number; bytes: number; tier: string; items: CleanupItem[] }
  >();

  for (const item of deletable as CleanupItem[]) {
    const key = item.sender_email ?? item.sender_name ?? 'unknown';
    const group = bySender.get(key) ?? {
      sender: key,
      senderName: item.sender_name,
      count: 0,
      bytes: 0,
      tier: item.tier, // a group is "auto" only if all its items are auto
      items: [],
    };
    group.count += 1;
    group.bytes += item.size_estimate ?? 0;
    if (item.tier !== 'auto') group.tier = 'review';
    group.items.push(item);
    bySender.set(key, group);
  }

  const groups = Array.from(bySender.values()).sort((a, b) => b.bytes - a.bytes);

  return NextResponse.json({ run, groups, protectedCount });
}
