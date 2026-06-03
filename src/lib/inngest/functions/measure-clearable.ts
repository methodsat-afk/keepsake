import { inngest } from '../client';
import { getGmailClient } from '@/lib/gmail/client';
import { createServiceClient } from '@/lib/supabase/server';
import { MAX_CLEANUP_EMAILS } from '@/lib/limits';

/**
 * Measure clearable junk bytes — DETERMINISTIC, ZERO LLM CALLS.
 *
 * Sums Gmail `sizeEstimate` for promotional/social mail (the same clutter the
 * cleanup feature targets), so we can quote a GB-based price BEFORE checkout
 * without any model spend. This is the pre-purchase price input; the actual
 * LLM-based junk review happens later, post-purchase. See src/lib/pricing.ts.
 *
 * Triggered after a photo scan completes (keepsake/measure.start).
 */
const CLEARABLE_QUERY =
  '(category:promotions OR category:social) older_than:1y -is:starred -is:important';

export const measureClearable = inngest.createFunction(
  {
    id: 'measure-clearable',
    retries: 2,
    triggers: [{ event: 'keepsake/measure.start' }],
  },
  async ({ event, step }) => {
    const { userId, accessToken, refreshToken } = event.data as {
      userId: string;
      accessToken: string;
      refreshToken: string | null;
    };

    try {
      // ── Step 1: sample one page (~100 msgs) for an average message size ──
      // Per-message size needs messages.get (~0.17s each), so we sample ONE
      // page instead of fetching every message — measuring all of them serially
      // would take minutes and blow the step timeout. The average × total count
      // is plenty accurate for choosing a price tier.
      const { avgBytes, sampleCount } = await step.run('sample-sizes', async () => {
        const gmail = getGmailClient(accessToken, refreshToken ?? undefined);
        const list = await gmail.users.messages.list({
          userId: 'me',
          maxResults: 100,
          q: CLEARABLE_QUERY,
        });
        const ids = (list.data.messages ?? [])
          .map((m) => m.id)
          .filter((id): id is string => Boolean(id));

        let sum = 0;
        let n = 0;
        for (const id of ids) {
          try {
            const msg = await gmail.users.messages.get({
              userId: 'me',
              id,
              format: 'metadata',
              metadataHeaders: ['From'],
            });
            sum += msg.data.sizeEstimate ?? 0;
            n++;
          } catch {
            // skip unreadable message
          }
        }
        return { avgBytes: n > 0 ? sum / n : 0, sampleCount: n };
      });

      // ── Step 2: count total matching messages via lightweight list calls ──
      // list() returns up to 500 ids per call with NO per-message fetch, so
      // counting thousands is fast. Capped by MAX_CLEANUP_EMAILS.
      const totalCount = await step.run('count-messages', async () => {
        const gmail = getGmailClient(accessToken, refreshToken ?? undefined);
        let count = 0;
        let pageToken: string | undefined;
        do {
          const list = await gmail.users.messages.list({
            userId: 'me',
            maxResults: 500,
            q: CLEARABLE_QUERY,
            ...(pageToken ? { pageToken } : {}),
          });
          count += (list.data.messages ?? []).length;
          pageToken = list.data.nextPageToken ?? undefined;
          if (count >= MAX_CLEANUP_EMAILS) break;
        } while (pageToken);
        return count;
      });

      const totalBytes = Math.round(avgBytes * totalCount);

      await step.run('save-clearable', async () => {
        const supabase = createServiceClient();
        await supabase
          .from('profiles')
          .update({
            clearable_bytes: totalBytes,
            clearable_measured_at: new Date().toISOString(),
          })
          .eq('id', userId);
      });

      return { totalBytes, totalCount, sampleCount, avgBytes };
    } catch (err) {
      // Non-fatal: if measurement fails, the user simply gets the base tier.
      console.error('[measure-clearable] failed:', err);
      return { totalBytes: 0 };
    }
  }
);
