import { inngest } from '../client';
import { getGmailClient } from '@/lib/gmail/client';
import { createServiceClient } from '@/lib/supabase/server';
import { MAX_CLEANUP_EMAILS } from '@/lib/limits';

/**
 * Inbox cleanup — stage 1: scan for junk candidates.
 *
 * DRY-RUN / NON-DESTRUCTIVE: this function only LISTS messages and fans out one
 * classification event per candidate. It never fetches bodies and never trashes
 * anything. See docs/inbox-cleanup-design.md §5. Mirrors scan-inbox's paginate +
 * fan-out shape.
 *
 * The list query is biased toward clutter so we don't waste classification on the
 * primary inbox: promotions/social, older than a year, not starred/important.
 */
const JUNK_QUERY =
  '(category:promotions OR category:social) older_than:1y -is:starred -is:important';

export const scanJunk = inngest.createFunction(
  {
    id: 'scan-junk',
    retries: 2,
    triggers: [{ event: 'keepsake/cleanup.start' }],
  },
  async ({ event, step }) => {
    const { userId, runId, accessToken, refreshToken } = event.data as {
      userId: string;
      runId: string;
      accessToken: string;
      refreshToken: string | null;
    };

    await step.run('mark-scanning', async () => {
      const supabase = createServiceClient();
      await supabase.from('cleanup_runs').update({ status: 'scanning' }).eq('id', runId);
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
              q: JUNK_QUERY,
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
              name: 'keepsake/cleanup.item' as const,
              data: { userId, runId, emailId, accessToken, refreshToken },
            }))
          );
          totalEmails += emailIds.length;

          await step.run(`update-progress-${page}`, async () => {
            const supabase = createServiceClient();
            await supabase
              .from('cleanup_runs')
              .update({ emails_scanned: totalEmails })
              .eq('id', runId);
          });
        }

        pageToken = nextCursor ?? undefined;

        // Circuit breaker: never fan out more than MAX_CLEANUP_EMAILS, no matter
        // how large the inbox. This caps the downstream LLM spend.
        if (totalEmails >= MAX_CLEANUP_EMAILS) {
          pageToken = undefined;
        }
      } while (pageToken);

      // Move to the review state. Items keep arriving via the fan-out and update
      // junk_found independently; 'review' means "scan finished, results are ready".
      // (totalEmails is capped at MAX_CLEANUP_EMAILS above.)
      await step.run('mark-review', async () => {
        const supabase = createServiceClient();
        await supabase
          .from('cleanup_runs')
          .update({ status: 'review' })
          .eq('id', runId);
      });

      return { totalEmails };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await step.run('mark-error', async () => {
        const supabase = createServiceClient();
        await supabase
          .from('cleanup_runs')
          .update({ status: 'error', error_message: message })
          .eq('id', runId);
      });
      throw err;
    }
  }
);
