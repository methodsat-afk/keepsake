export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { nylas } from '@/lib/nylas/client';
import { createClient } from '@/lib/supabase/server';
import type { Provider } from 'nylas';

/**
 * GET /api/auth/nylas?provider=google|microsoft|yahoo
 * Generates a Nylas OAuth URL and redirects the user to it.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const providerParam = request.nextUrl.searchParams.get('provider') ?? 'google';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  // Map UI provider names to Nylas provider types
  const providerMap: Record<string, Provider> = {
    google: 'google',
    microsoft: 'microsoft',
    yahoo: 'imap',
    hotmail: 'microsoft',
  };
  const provider: Provider = providerMap[providerParam] ?? 'google';

  const authUrl = nylas.auth.urlForOAuth2({
    clientId: process.env.NYLAS_CLIENT_ID!,
    redirectUri: `${appUrl}/api/auth/nylas/callback`,
    provider,
  });

  return NextResponse.redirect(authUrl);
}
