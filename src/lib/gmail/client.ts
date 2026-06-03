import { google, gmail_v1 } from 'googleapis';

export function getGmailClient(accessToken: string, refreshToken?: string) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  );

  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
    // When we have a refresh token, mark the stored access token as already
    // expired so googleapis transparently refreshes it on the first API call.
    // Stored access tokens live ~1h; background jobs often run after they lapse.
    // Without this, googleapis assumes the (stale) token is valid and every
    // request 401s. (Caused the GB-measurement to silently record 0 bytes.)
    ...(refreshToken ? { expiry_date: 1 } : {}),
  });

  return google.gmail({ version: 'v1', auth: oauth2Client });
}

/** Recursively extract image attachments from a Gmail message's MIME parts. */
export function extractAttachments(
  parts: gmail_v1.Schema$MessagePart[]
): { id: string; contentType: string; size: number; filename: string }[] {
  const results: { id: string; contentType: string; size: number; filename: string }[] = [];

  for (const part of parts) {
    if (part.filename && part.body?.attachmentId && part.mimeType) {
      results.push({
        id: part.body.attachmentId,
        contentType: part.mimeType,
        size: part.body.size ?? 0,
        filename: part.filename,
      });
    }
    if (part.parts) {
      results.push(...extractAttachments(part.parts));
    }
  }

  return results;
}

/** Parse a Gmail "From" header like "Name <email@x.com>" into parts. */
export function parseFrom(from: string): { name: string | null; email: string | null } {
  const match = from.match(/^(.*?)\s*<(.+?)>$/);
  if (match) {
    return {
      name: match[1].trim() || null,
      email: match[2].trim() || null,
    };
  }
  return { name: null, email: from.trim() || null };
}
