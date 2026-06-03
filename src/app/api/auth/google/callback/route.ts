export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { inngest } from '@/lib/inngest/client';

/**
 * GET /api/auth/google/callback
 * Handles the OAuth callback from Google. Exchanges the code for tokens,
 * stores them on the scan record, and fires the Inngest scan job.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get('code');
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  if (!code) {
    return NextResponse.redirect(`${appUrl}/scan?error=no_code`);
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${appUrl}/login`);
  }

  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${appUrl}/api/auth/google/callback`,
    );

    const { tokens } = await oauth2Client.getToken(code);
    const accessToken = tokens.access_token!;
    const refreshToken = tokens.refresh_token ?? null;

    const serviceClient = createServiceClient();

    // ── Scan limit gate (pre-purchase) ──────────────────────────────────────
    // Paid users scan freely. Free users get `scan_limit` SUCCESSFUL scans.
    // We also block starting a new scan while one is already running, so a
    // page-refresh can't farm scans — without charging anyone on a mere start.
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('has_paid, successful_scans, scan_limit')
      .eq('id', user.id)
      .single();

    if (!profile?.has_paid) {
      const used = profile?.successful_scans ?? 0;
      const limit = profile?.scan_limit ?? 2;
      if (used >= limit) {
        return NextResponse.redirect(`${appUrl}/scan?error=scan_limit`);
      }
      // Running-guard: don't start if a scan is already in flight.
      const { count: inFlight } = await serviceClient
        .from('scans')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .in('status', ['pending', 'running']);
      if ((inFlight ?? 0) > 0) {
        return NextResponse.redirect(`${appUrl}/scan`);
      }
    }

    await serviceClient
      .from('profiles')
      .update({ scan_status: 'scanning' })
      .eq('id', user.id);

    const { data: scan, error } = await serviceClient
      .from('scans')
      .insert({
        user_id: user.id,
        provider: 'google',
        status: 'pending',
        gmail_access_token: accessToken,
        gmail_refresh_token: refreshToken,
      })
      .select()
      .single();

    if (error || !scan) {
      console.error('[google-callback] Failed to create scan:', error);
      return NextResponse.redirect(`${appUrl}/scan?error=db_error`);
    }

    await inngest.send({
      name: 'keepsake/scan.start',
      data: {
        userId: user.id,
        scanId: scan.id,
        provider: 'google',
        accessToken,
        refreshToken,
      },
    });

    return NextResponse.redirect(`${appUrl}/scan`);
  } catch (err) {
    console.error('[google-callback] Error:', err);
    return NextResponse.redirect(`${appUrl}/scan?error=auth_failed`);
  }
}
