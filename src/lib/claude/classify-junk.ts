import { getAnthropic } from './client';
import {
  tierFromSignals,
  AUTO_CONFIDENCE_THRESHOLD,
  type JunkSignals,
  type JunkTierResult,
} from './junk-tier';
import type { CleanupTier } from '@/types';

/**
 * Junk classification for inbox cleanup. Text/metadata only — we never fetch or
 * send the email body. See docs/inbox-cleanup-design.md §4.
 *
 * The safety-critical tiering gate lives in ./junk-tier (pure, unit-tested). This
 * module adds the optional Haiku tie-breaker for ambiguous `review`-tier items.
 * The LLM can refine JUNK/KEEP within the review tier but can NEVER promote an
 * item to the `auto` (auto-trash) tier.
 */

export {
  tierFromSignals,
  AUTO_CONFIDENCE_THRESHOLD,
  type JunkSignals,
  type JunkTierResult,
};

export interface JunkResult {
  result: 'JUNK' | 'KEEP';
  tier: CleanupTier;
  confidence: number;
  reason: string;
}

/**
 * Full classification. Runs the pure tiering first; only invokes Haiku when the
 * deterministic stage is uncertain (`needsLlm`).
 *
 * `canCallLlm` is an optional async budget gate: it is invoked right before the
 * model call and, if it resolves false (budget exhausted / run cancelled), the
 * item is kept as a deterministic 'review' result with NO LLM call. This is the
 * circuit breaker that caps per-run API spend.
 *
 * Fail-safe: on any error or non-bulk content, defaults to KEEP / review so we
 * never auto-trash on uncertainty.
 */
export async function classifyJunk(
  signals: JunkSignals,
  canCallLlm?: () => Promise<boolean>
): Promise<JunkResult> {
  const tierResult = tierFromSignals(signals);

  // Protected and auto tiers are fully decided by deterministic rules.
  if (tierResult.tier === 'protected') {
    return { result: 'KEEP', tier: 'protected', confidence: tierResult.confidence, reason: tierResult.reason };
  }
  if (tierResult.tier === 'auto') {
    return { result: 'JUNK', tier: 'auto', confidence: tierResult.confidence, reason: tierResult.reason };
  }

  // review tier: optionally ask the model to refine JUNK vs KEEP.
  if (!tierResult.needsLlm) {
    return { result: 'KEEP', tier: 'review', confidence: tierResult.confidence, reason: tierResult.reason };
  }

  // Budget gate: if the per-run LLM cap is hit (or the run was cancelled), skip
  // the model and keep the deterministic review result. Functionality preserved
  // (item is still surfaced for review), spend is capped.
  if (canCallLlm && !(await canCallLlm())) {
    return {
      result: 'KEEP',
      tier: 'review',
      confidence: tierResult.confidence,
      reason: 'Kept for review (classification budget reached)',
    };
  }

  try {
    const response = await getAnthropic().messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 10,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text:
                'Classify this email by its metadata as bulk clutter (JUNK) or something a person may want to keep (KEEP). ' +
                'Newsletters, promotions, marketing, social notifications, automated receipts are JUNK. ' +
                'Personal messages, anything financial/legal/medical, or anything from a real individual are KEEP. ' +
                'Reply with exactly one word: JUNK or KEEP.\n\n' +
                `From: ${signals.sender ?? 'unknown'}\n` +
                `Subject: ${signals.subject ?? '(none)'}\n` +
                `Preview: ${signals.snippet ?? '(none)'}`,
            },
          ],
        },
      ],
    });

    const text = response.content[0]?.type === 'text'
      ? response.content[0].text.trim().toUpperCase()
      : 'KEEP';
    const isJunk = text.startsWith('JUNK');

    return {
      result: isJunk ? 'JUNK' : 'KEEP',
      tier: 'review', // LLM stays within review — it can never auto-trash.
      confidence: isJunk ? Math.max(tierResult.confidence, 0.7) : 0.2,
      reason: isJunk ? 'AI flagged as bulk clutter' : 'AI judged worth keeping',
    };
  } catch (err) {
    console.error('[classify-junk] error — defaulting to KEEP/review:', err);
    return { result: 'KEEP', tier: 'review', confidence: 0.2, reason: 'Could not classify — kept for safety' };
  }
}
