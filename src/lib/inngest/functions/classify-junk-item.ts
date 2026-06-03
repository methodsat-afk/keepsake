import { inngest } from '../client';
import { getGmailClient, parseFrom } from '@/lib/gmail/client';
import { classifyJunk, type JunkSignals } from '@/lib/claude/classify-junk';
import { createServiceClient } from '@/lib/supabase/server';
import { MAX_CLEANUP_LLM_CALLS } from '@/lib/limits';
import type { gmail_v1 } from 'googleapis';

/**
 * Inbox cleanup — stage 2: classify one candidate message.
 *
 * DRY-RUN / NON-DESTRUCTIVE: fetches Gmail METADATA only (headers + labelIds, never
 * the body), derives signals, runs the tiering classifier, and upserts one
 * cleanup_items row. It NEVER trashes anything. See docs/inbox-cleanup-design.md §5.
 */

function header(headers: gmail_v1.Schema$MessagePartHeader[], name: string): string | null {
  const lower = name.toLowerCase();
  return headers.find((h) => h.name?.toLowerCase() === lower)?.value ?? null;
}

/** Pick the Gmail CATEGORY_* label, if any, from the message's labelIds. */
function categoryFrom(labelIds: string[]): string | null {
  return labelIds.find((l) => l.startsWith('CATEGORY_')) ?? null;
}

export const classifyJunkItem = inngest.createFunction(
  {
    id: 'classify-junk-item',
    retries: 3,
    concurrency: { limit: 20 },
    triggers: [{ event: 'keepsake/cleanup.item' }],
  },
  async ({ event, step }) => {
    const { userId, runId, emailId, accessToken, refreshToken } = event.data as {
      userId: string;
      runId: string;
      emailId: string;
      accessToken: string;
      refreshToken: string | null;
    };

    await step.run('classify-item', async () => {
      const supabaseEarly = createServiceClient();
      // Kill switch: if the run was cancelled, do no work (no Gmail fetch, no LLM).
      const { data: cancelled } = await supabaseEarly.rpc('is_run_cancelled', {
        run_id_input: runId,
      });
      if (cancelled === true) return;

      const gmail = getGmailClient(accessToken, refreshToken ?? undefined);

      let message: gmail_v1.Schema$Message;
      try {
        // METADATA format — headers + labelIds + sizeEstimate only. No body.
        const response = await gmail.users.messages.get({
          userId: 'me',
          id: emailId,
          format: 'metadata',
          metadataHeaders: ['From', 'Subject', 'Date', 'List-Unsubscribe'],
        });
        message = response.data;
      } catch (err) {
        console.error(`[classify-junk-item] Failed to fetch metadata ${emailId}:`, err);
        return;
      }

      const headers = message.payload?.headers ?? [];
      const labelIds = message.labelIds ?? [];
      const from = header(headers, 'From') ?? '';
      const subject = header(headers, 'Subject');
      const dateStr = header(headers, 'Date');
      const { name: senderName, email: senderEmail } = parseFrom(from);

      const supabase = createServiceClient();

      // Protection signal: did we rescue a photo from this exact message?
      // Our photos table doesn't store the Gmail message id, so we conservatively
      // treat a sender match within this user's rescued photos as a soft signal.
      // (Exact message-id linkage is a future enhancement; erring toward protect.)
      let hasRescuedAttachment = false;
      if (senderEmail) {
        const { count } = await supabase
          .from('photos')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('sender_email', senderEmail);
        hasRescuedAttachment = (count ?? 0) > 0;
      }

      const signals: JunkSignals = {
        category: categoryFrom(labelIds),
        hasListUnsubscribe: header(headers, 'List-Unsubscribe') !== null,
        isStarred: labelIds.includes('STARRED'),
        isImportant: labelIds.includes('IMPORTANT'),
        // Gmail sets SENT on a thread's labels when the user has sent in it; the
        // message-level proxy we have is whether this message itself is in SENT.
        hasUserReply: labelIds.includes('SENT'),
        hasRescuedAttachment,
        sender: senderEmail ?? from,
        subject,
        snippet: message.snippet ?? null,
      };

      // Budget gate: atomically claim one LLM slot for this run (caps spend).
      const canCallLlm = async () => {
        const { data: ok } = await supabase.rpc('claim_llm_call', {
          run_id_input: runId,
          budget: MAX_CLEANUP_LLM_CALLS,
        });
        return ok === true;
      };

      const { tier, confidence, reason, result } = await classifyJunk(signals, canCallLlm);

      const internalDate = message.internalDate
        ? new Date(Number(message.internalDate)).toISOString()
        : dateStr
        ? new Date(dateStr).toISOString()
        : null;

      // Upsert the candidate row (idempotent on (run_id, gmail_message_id)).
      const { error: upsertError } = await supabase
        .from('cleanup_items')
        .upsert(
          {
            run_id: runId,
            user_id: userId,
            gmail_message_id: emailId,
            gmail_thread_id: message.threadId ?? null,
            sender_email: senderEmail,
            sender_name: senderName,
            subject,
            internal_date: internalDate,
            size_estimate: message.sizeEstimate ?? null,
            gmail_category: signals.category,
            has_list_unsubscribe: signals.hasListUnsubscribe,
            confidence,
            reason,
            tier,
            // Auto-tier items are pre-approved; everything else awaits the user.
            decision: tier === 'auto' ? 'approved' : 'pending',
          },
          { onConflict: 'run_id,gmail_message_id' }
        );

      if (upsertError) {
        console.error(`[classify-junk-item] upsert failed for ${emailId}:`, upsertError);
        return;
      }

      console.log(
        `[classify-junk-item] ${emailId} → tier=${tier} result=${result} conf=${confidence} (${reason})`
      );

      // Race-safe recompute of junk_found (mirrors the photos_found pattern).
      await supabase.rpc('recompute_cleanup_counts', { run_id_input: runId });
    });
  }
);
