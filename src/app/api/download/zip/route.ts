export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { downloadFromStorage } from '@/lib/r2/upload';
import { zipSync } from 'fflate';
import { normalizeCategory, categoryFolder } from '@/lib/photo-categories';

/**
 * GET /api/download/zip
 * Returns a ZIP of all rescued photos organized as Category/Year/.
 * Requires the user to have paid.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const serviceClient = createServiceClient();
  const { data: profile } = await serviceClient
    .from('profiles')
    .select('has_paid')
    .eq('id', user.id)
    .single();

  if (!profile?.has_paid) {
    return NextResponse.json({ error: 'Payment required' }, { status: 402 });
  }

  const { data: photos } = await serviceClient
    .from('photos')
    .select('*')
    .eq('user_id', user.id)
    .order('email_date', { ascending: true });

  if (!photos || photos.length === 0) {
    return NextResponse.json({ error: 'No photos found' }, { status: 404 });
  }

  // zipSync builds the whole archive in memory, so a user with thousands of
  // photos could OOM a serverless function. Cap total uncompressed bytes; if we
  // hit it, return a partial ZIP and tell the client it was truncated.
  const MAX_ZIP_BYTES = 400 * 1024 * 1024; // ~400 MB uncompressed ceiling

  // Build the file map for fflate: { "Category/Year/filename.jpg": Uint8Array }
  const files: Record<string, Uint8Array> = {};
  // Guard against two photos sharing a path within the same Category/Year.
  const usedPaths = new Set<string>();
  let accumulatedBytes = 0;
  let truncated = false;
  let included = 0;

  for (const photo of photos) {
    try {
      const buffer = await downloadFromStorage(photo.r2_key);

      // Stop before we blow the memory ceiling. Always include at least one.
      if (included > 0 && accumulatedBytes + buffer.length > MAX_ZIP_BYTES) {
        truncated = true;
        break;
      }

      const folder = categoryFolder(normalizeCategory(photo.category));
      const year = photo.email_date
        ? new Date(photo.email_date).getUTCFullYear().toString()
        : 'unknown';
      const filename = photo.r2_key.split('/').pop() ?? `${photo.id}.jpg`;

      let path = `${folder}/${year}/${filename}`;
      if (usedPaths.has(path)) {
        // De-dupe by inserting the photo id before the extension.
        const dot = filename.lastIndexOf('.');
        const stem = dot > 0 ? filename.slice(0, dot) : filename;
        const ext = dot > 0 ? filename.slice(dot) : '';
        path = `${folder}/${year}/${stem}-${photo.id.slice(0, 8)}${ext}`;
      }
      usedPaths.add(path);
      files[path] = new Uint8Array(buffer);
      accumulatedBytes += buffer.length;
      included += 1;
    } catch (err) {
      console.error(`[zip] Failed to add photo ${photo.id}:`, err);
    }
  }

  if (truncated) {
    console.warn(
      `[zip] Truncated: included ${included}/${photos.length} photos (~${Math.round(accumulatedBytes / 1024 / 1024)}MB cap).`
    );
  }

  if (Object.keys(files).length === 0) {
    return NextResponse.json({ error: 'Failed to download photos' }, { status: 500 });
  }

  // Compress synchronously — fine for typical photo counts (< a few hundred)
  const zipped = zipSync(files, { level: 6 });

  return new Response(zipped, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="keepsake-photos.zip"',
      'Content-Length': zipped.byteLength.toString(),
      'Cache-Control': 'no-store',
      // Clients can read these to warn the user if the archive was capped.
      'X-Keepsake-Photo-Count': included.toString(),
      'X-Keepsake-Total-Photos': photos.length.toString(),
      'X-Keepsake-Truncated': truncated ? 'true' : 'false',
    },
  });
}
