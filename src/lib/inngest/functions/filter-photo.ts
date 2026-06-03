import { inngest } from '../client';
import { getGmailClient, extractAttachments, parseFrom } from '@/lib/gmail/client';
import { classify } from '@/lib/claude/classify';
import { uploadToR2 } from '@/lib/r2/upload';
import { createServiceClient } from '@/lib/supabase/server';
import { MAX_PHOTO_LLM_CALLS, MAX_PHOTO_STORE } from '@/lib/limits';
import { v4 as uuidv4 } from 'uuid';

const ALLOWED_CONTENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const MIN_SIZE_BYTES = 10 * 1024; // 10 KB

function extFromContentType(ct: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
  };
  return map[ct] ?? 'jpg';
}

/**
 * Inngest function that processes a single email via Gmail API,
 * inspects its attachments, classifies each qualifying image with Claude,
 * and saves real photos to storage and Supabase.
 */
export const filterPhoto = inngest.createFunction(
  {
    id: 'filter-photo',
    retries: 3,
    concurrency: { limit: 20 },
    triggers: [{ event: 'keepsake/email.process' }],
  },
  async ({ event, step }) => {
    const { userId, scanId, emailId, accessToken, refreshToken } = event.data as {
      userId: string;
      scanId: string;
      emailId: string;
      provider: string;
      accessToken: string;
      refreshToken: string | null;
    };

    await step.run('process-email', async () => {
      if (process.env.NODE_ENV === 'development') {
        await new Promise((r) => setTimeout(r, 500));
      }

      const gmail = getGmailClient(accessToken, refreshToken ?? undefined);

      let message;
      try {
        const response = await gmail.users.messages.get({
          userId: 'me',
          id: emailId,
          format: 'full',
        });
        message = response.data;
      } catch (err) {
        console.error(`[filter-photo] Failed to fetch email ${emailId}:`, err);
        return;
      }

      // Parse headers
      const headers = message.payload?.headers ?? [];
      const from = headers.find((h) => h.name === 'From')?.value ?? '';
      const subject = headers.find((h) => h.name === 'Subject')?.value ?? '';
      const date = headers.find((h) => h.name === 'Date')?.value ?? '';

      const { name: senderName, email: senderEmail } = parseFrom(from);
      const emailSubject = subject || null;
      const emailDate = date ? new Date(date).toISOString() : null;

      // Extract attachments from MIME parts
      const parts = message.payload?.parts ?? [];
      const attachments = extractAttachments(parts);

      for (const attachment of attachments) {
        const contentType = attachment.contentType;
        const size = attachment.size;

        if (!ALLOWED_CONTENT_TYPES.has(contentType)) continue;
        if (size < MIN_SIZE_BYTES) continue;

        try {
          // Download attachment bytes from Gmail API
          const attachmentResponse = await gmail.users.messages.attachments.get({
            userId: 'me',
            messageId: emailId,
            id: attachment.id,
          });

          const data = attachmentResponse.data.data;
          if (!data) continue;

          // Gmail uses URL-safe base64 encoding
          const buffer = Buffer.from(data, 'base64url');
          if (buffer.length < MIN_SIZE_BYTES) continue;

          // Circuit breaker: cap image classifications per scan (images are the
          // pricey calls). If the budget is exhausted, stop classifying further
          // attachments — the scan still completes with what it already found.
          const budgetClient = createServiceClient();
          const { data: mayClassify } = await budgetClient.rpc('claim_scan_llm_call', {
            scan_id_input: scanId,
            budget: MAX_PHOTO_LLM_CALLS,
          });
          if (mayClassify !== true) {
            console.warn(`[filter-photo] image-classify budget reached for scan ${scanId}; skipping rest`);
            break;
          }

          const { result, confidence, category } = await classify(buffer, contentType);
          if (result !== 'PHOTO') continue;

          // Circuit breaker: cap how many photos this scan STORES. Claim a slot
          // BEFORE uploading so we never pay storage/egress beyond the cap. If
          // the cap is reached, stop storing further photos for this scan.
          const { data: mayStore } = await budgetClient.rpc('claim_photo_store', {
            scan_id_input: scanId,
            budget: MAX_PHOTO_STORE,
          });
          if (mayStore !== true) {
            console.warn(`[filter-photo] photo-storage cap reached for scan ${scanId}; not storing more`);
            break;
          }

          const ext = extFromContentType(contentType);
          const key = `${userId}/${scanId}/${uuidv4()}.${ext}`;
          const r2Url = await uploadToR2(key, buffer, contentType);

          const supabase = createServiceClient();
          const { data: photo } = await supabase
            .from('photos')
            .insert({
              user_id: userId,
              scan_id: scanId,
              r2_key: key,
              r2_url: r2Url,
              sender_name: senderName,
              sender_email: senderEmail,
              email_subject: emailSubject,
              email_date: emailDate,
              file_size: buffer.length,
              mime_type: contentType,
              ai_confidence: confidence,
              category,
            })
            .select()
            .single();

          if (photo) {
            await inngest.send({
              name: 'keepsake/photo.found',
              data: { photo },
            });
          }
        } catch (err) {
          console.error(`[filter-photo] Error processing attachment in ${emailId}:`, err);
        }
      }

      try {
        const supabase = createServiceClient();
        await supabase.rpc('increment_emails_processed', { scan_id_input: scanId });

        // Keep scans.photos_found accurate. We recompute from the source of
        // truth (the photos table) rather than incrementing, so the value stays
        // correct even though many filter-photo runs execute concurrently in
        // the fan-out — whichever write lands last still reflects the true count.
        const { count } = await supabase
          .from('photos')
          .select('id', { count: 'exact', head: true })
          .eq('scan_id', scanId);

        await supabase
          .from('scans')
          .update({ photos_found: count ?? 0 })
          .eq('id', scanId);
      } catch (err) {
        console.error('[filter-photo] Failed to update scan counters:', err);
      }
    });
  }
);
