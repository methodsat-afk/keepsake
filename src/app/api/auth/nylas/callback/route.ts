export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { nylas } from '@/lib/nylas/client';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { inngest } from '@/lib/inngest/client';

/**
 * GET /api/auth/nylas/callback
 * Handles the OAuth callback from Nylas. Exchanges the code for a grant ID,
 * stores it on the user's profile, creates a scan record, and fires the scan job.
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
    const tokenData = await nylas.auth.exchangeCodeForToken({
      clientSecret: process.env.NYLAS_CLIENT_SECRET!,
      clientId: process.env.NYLAS_CLIENT_ID!,
      redirectUri: `${appUrl}/api/auth/nylas/callback`,
      code,
    });

    const nylasGrantId = tokenData.grantId;
    const provider = tokenData.provider ?? 'google';

    const serviceClient = createServiceClient();

    // Store grant ID on profile
    await serviceClient
      .from('profiles')
      .update({ scan_status: 'scanning' })
      .eq('id', user.id);

    // Create a new scan record
    const { data: scan, error } = await serviceClient
      .from('scans')
      .insert({
        user_id: user.id,
        nylas_grant_id: nylasGrantId,
        provider,
        status: 'pending',
      })
      .select()
      .single();

    if (error || !scan) {
      throw new Error('Failed to create scan record');
    }

    // Fire the Inngest scan job
    await inngest.send({
      name: 'keepsake/scan.start',
      data: {
        userId: user.id,
        scanId: scan.id,
        nylasGrantId,
      },
    });

    return NextResponse.redirect(`${appUrl}/scan`);
  } catch (err) {
    console.error('[nylas-callback] Error:', err);
    return NextResponse.redirect(`${appUrl}/scan?error=auth_failed`);
  }
}
