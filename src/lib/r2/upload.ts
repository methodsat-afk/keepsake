import { createClient } from '@supabase/supabase-js';

const BUCKET = 'keepsake-photos';

function getStorage() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  ).storage;
}

/**
 * Uploads a buffer to Supabase Storage and returns the public URL.
 * @param key - Storage path, e.g. `userId/scanId/filename.jpg`
 * @param buffer - Raw file bytes
 * @param mimeType - MIME type, e.g. `image/jpeg`
 * @returns The public URL of the uploaded file
 */
export async function uploadToR2(
  key: string,
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  const storage = getStorage();

  const { error } = await storage
    .from(BUCKET)
    .upload(key, buffer, { contentType: mimeType, upsert: false });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  const { data } = storage.from(BUCKET).getPublicUrl(key);
  return data.publicUrl;
}

/**
 * Downloads a file from Supabase Storage and returns it as a Buffer.
 * @param key - Storage path, e.g. `userId/scanId/filename.jpg`
 */
export async function downloadFromStorage(key: string): Promise<Buffer> {
  const storage = getStorage();
  const { data, error } = await storage.from(BUCKET).download(key);
  if (error || !data) throw new Error(`Storage download failed: ${error?.message}`);
  return Buffer.from(await data.arrayBuffer());
}
