import type { CleanupTier } from '@/types';

/**
 * PURE, deterministic trust-tiering for inbox cleanup. No I/O, no imports with
 * side effects — so it is exhaustively unit-testable and safe to reason about.
 * This is the safety-critical gate: the LLM stage (in classify-junk.ts) can never
 * move an item into the `auto` tier; only the rules here can. See
 * docs/inbox-cleanup-design.md §2 and §4.
 */

/** Signals pulled from a Gmail message's metadata (headers + labelIds). */
export interface JunkSignals {
  /** Gmail category label, e.g. CATEGORY_PROMOTIONS / CATEGORY_SOCIAL / CATEGORY_PERSONAL. */
  category: string | null;
  /** True if a List-Unsubscribe header is present (machine bulk-mail fingerprint). */
  hasListUnsubscribe: boolean;
  /** True if the message is starred. */
  isStarred: boolean;
  /** True if Gmail marks the message Important. */
  isImportant: boolean;
  /** True if the user has sent a reply in this thread (we treat as personal). */
  hasUserReply: boolean;
  /** True if we rescued a photo attachment from this message. */
  hasRescuedAttachment: boolean;
  sender: string | null;
  subject: string | null;
  /** Gmail-provided snippet (NOT full body). Optional; used only by the LLM stage. */
  snippet?: string | null;
}

export interface JunkTierResult {
  tier: CleanupTier;
  confidence: number;
  reason: string;
  /** True when stage 1 alone can't decide and an LLM tie-break is warranted. */
  needsLlm: boolean;
}

/** Confidence at/above which a fully-fingerprinted bulk message may auto-trash. */
export const AUTO_CONFIDENCE_THRESHOLD = 0.92;

/** Sender/subject keywords that force a message to never auto-trash (review at most). */
const PROTECTED_KEYWORDS = [
  'bank', 'irs', 'gov', 'tax', 'legal', 'attorney', 'lawyer', 'insurance',
  'invoice', 'statement', 'mortgage', 'loan', 'medical', 'health', 'doctor',
  'passport', 'visa', 'court', 'benefits', 'social security', 'pension',
];

/** Gmail categories we consider bulk/clutter-leaning. */
const BULK_CATEGORIES = new Set(['CATEGORY_PROMOTIONS', 'CATEGORY_SOCIAL']);
/** Gmail categories we always protect. */
const PROTECTED_CATEGORIES = new Set(['CATEGORY_PERSONAL', 'CATEGORY_PRIMARY']);

function matchesProtectedKeyword(...fields: (string | null | undefined)[]): boolean {
  const hay = fields.filter(Boolean).join(' ').toLowerCase();
  return PROTECTED_KEYWORDS.some((kw) => hay.includes(kw));
}

/**
 * Given Gmail metadata, decide the trust tier. The auto (auto-trash) tier requires
 * the full deterministic fingerprint: a bulk category AND a List-Unsubscribe header,
 * with no protection signals. Anything missing a signal falls to review at most.
 */
export function tierFromSignals(s: JunkSignals): JunkTierResult {
  // 1. Hard protections — never touch, never even show as deletable.
  if (s.isStarred) {
    return { tier: 'protected', confidence: 0, reason: 'Starred by you', needsLlm: false };
  }
  if (s.isImportant) {
    return { tier: 'protected', confidence: 0, reason: 'Marked important', needsLlm: false };
  }
  if (s.hasUserReply) {
    return { tier: 'protected', confidence: 0, reason: 'You replied in this thread', needsLlm: false };
  }
  if (s.hasRescuedAttachment) {
    return { tier: 'protected', confidence: 0, reason: 'Contains a rescued photo', needsLlm: false };
  }
  if (s.category && PROTECTED_CATEGORIES.has(s.category)) {
    return { tier: 'protected', confidence: 0, reason: 'Personal mail', needsLlm: false };
  }
  if (matchesProtectedKeyword(s.sender, s.subject)) {
    // Looks financial/legal/medical — demote to review at most, never auto.
    return { tier: 'review', confidence: 0.3, reason: 'Possibly important (financial/legal/medical)', needsLlm: false };
  }

  const isBulkCategory = !!s.category && BULK_CATEGORIES.has(s.category);

  // 2. The auto fingerprint: bulk category AND List-Unsubscribe header together.
  if (isBulkCategory && s.hasListUnsubscribe) {
    return { tier: 'auto', confidence: 0.95, reason: 'Bulk mail with unsubscribe link', needsLlm: false };
  }

  // 3. Partial signals → review, optionally LLM-assisted.
  if (isBulkCategory || s.hasListUnsubscribe) {
    return {
      tier: 'review',
      confidence: 0.6,
      reason: s.hasListUnsubscribe ? 'Has unsubscribe link' : 'Promotional category',
      needsLlm: true,
    };
  }

  // 4. No bulk signals at all → keep (review tier, low confidence, let LLM look).
  return { tier: 'review', confidence: 0.2, reason: 'No strong junk signals', needsLlm: true };
}
