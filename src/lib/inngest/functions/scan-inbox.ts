import { inngest } from '../client';
import { getGmailClient } from '@/lib/gmail/client';
import { createServiceClient } from '@/lib/supabase/server';
import { MAX_PHOTO_EMAILS } from '@/lib/limits';

/**
 * Inngest function that orchestrates a full inbox scan.
 * For Gmail: uses the Gmail API directly.
 * Paginates through all emails with attachments and fans out one
 * `keepsake/email.process` event per email for parallel processing.
 */
export const scanInbox = inngest.createFunction(
  {
    id: 'scan-inbox',
    retries: 2,
    triggers: [{ event: 'keepsake/scan.start' }],
  },
  async ({ event, step }) => {
    const { userId, scanId, provider, accessToken, refreshToken } = event.data as {
      userId: string;
      scanId: string;
      provider: string;
      accessToken: string;
      refreshToken: string | null;
    };

    await step.run('mark-running', async () => {
      const supabase = createServiceClient();
      await supabase.from('scans').update({ status: 'running' }).eq('id', scanId);
    });

    let pageToken: string | undefined;
    let totalEmails = 0;
    let page = 0;

    try {
      do {
        page++;
        const currentPageToken = pageToken;

        const { emailIds, nextCursor } = await step.run(
          `fetch-page-${page}`,
          async () => {
            const gmail = getGmailClient(accessToken, refreshToken ?? undefined);
            const response = await gmail.users.messages.list({
              userId: 'me',
              maxResults: 100,
              q: 'has:attachment',
              ...(currentPageToken ? { pageToken: currentPageToken } : {}),
            });

            const ids = (response.data.messages ?? [])
              .map((m) => m.id)
              .filter((id): id is string => Boolean(id));

            return { emailIds: ids, nextCursor: response.data.nextPageToken ?? null };
          }
        );

        if (emailIds.length > 0) {
          await step.sendEvent(
            `fan-out-page-${page}`,
            emailIds.map((emailId) => ({
              name: 'keepsake/email.process' as const,
              data: { userId, scanId, emailId, provider, accessToken, refreshToken },
            }))
          );
          totalEmails += emailIds.length;

          await step.run(`update-progress-${page}`, async () => {
            const supabase = createServiceClient();
            await supabase
              .from('scans')
              .update({ emails_processed: totalEmails })
              .eq('id', scanId);
          });
        }

        pageToken = nextCursor ?? undefined;

        // Circuit breaker: cap total emails fanned out per scan.
        if (totalEmails >= MAX_PHOTO_EMAILS) {
          pageToken = undefined;
        }
      } while (pageToken);

      await step.run('mark-complete', async () => {
        const supabase = createServiceClient();
        await supabase
          .from('scans')
          .update({ status: 'complete', completed_at: new Date().toISOString() })
          .eq('id', scanId);
        await supabase
          .from('profiles')
          .update({ scan_status: 'complete' })
          .eq('id', userId);
        // Count this toward the pre-purchase scan limit ONLY on success, so our
        // own failures never burn a user's allowance.
        await supabase.rpc('increment_successful_scans', { user_id_input: userId });
      });

      // Kick off deterministic clearable-bytes measurement (no LLM) so the
      // download page can quote a GB-based price. Non-blocking, best-effort.
      await step.sendEvent('measure-clearable', {
        name: 'keepsake/measure.start',
        data: { userId, accessToken, refreshToken },
      });

      return { totalEmails };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await step.run('mark-error', async () => {
        const supabase = createServiceClient();
        await supabase
          .from('scans')
          .update({ status: 'error', error_message: message })
          .eq('id', scanId);
        await supabase
          .from('profiles')
          .update({ scan_status: 'error' })
          .eq('id', userId);
      });
      throw err;
    }
  }
);
