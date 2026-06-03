/**
 * Hard safety caps for the scan/classify pipelines.
 *
 * These exist because an unbounded fan-out over a large inbox can run up the
 * Anthropic bill (a 16.8k-email cleanup run made ~11k LLM calls overnight once).
 * Every limit here is a circuit breaker: the feature still works, it just stops
 * at a sane ceiling instead of processing an entire multi-year inbox.
 *
 * Override any of these via env without code changes (useful for testing or
 * raising a ceiling deliberately).
 */

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Photo scan: max emails (with attachments) to fan out per scan. */
export const MAX_PHOTO_EMAILS = envInt('KEEPSAKE_MAX_PHOTO_EMAILS', 3000);

/** Cleanup scan: max candidate emails to fan out per run. */
export const MAX_CLEANUP_EMAILS = envInt('KEEPSAKE_MAX_CLEANUP_EMAILS', 2000);

/**
 * Cleanup: max LLM (Haiku) classification calls per run. The deterministic
 * pre-filter handles most items for free; only ambiguous "review" items hit the
 * model. This caps that spend even if a huge inbox produces many ambiguous ones.
 * Once exceeded, remaining items are kept (tier='review', no LLM) for safety.
 */
export const MAX_CLEANUP_LLM_CALLS = envInt('KEEPSAKE_MAX_CLEANUP_LLM_CALLS', 600);

/** Photo classify: max image classifications per scan (images are the pricey calls). */
export const MAX_PHOTO_LLM_CALLS = envInt('KEEPSAKE_MAX_PHOTO_LLM_CALLS', 1500);

/**
 * Max photos we STORE per scan. Storage + egress cost scales with how many
 * images we keep, so a "whale" inbox with thousands of photos is the real cost
 * exposure (mirrors the LLM-call whale). Once hit, we stop uploading further
 * photos — the scan still completes, the user just keeps the first N rescued.
 */
export const MAX_PHOTO_STORE = envInt('KEEPSAKE_MAX_PHOTO_STORE', 500);

/** How many scans an account gets before paying (see profiles.scan_limit). */
export const DEFAULT_SCAN_LIMIT = envInt('KEEPSAKE_DEFAULT_SCAN_LIMIT', 2);
