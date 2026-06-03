/**
 * GB-based pricing tiers. We price the BENEFIT (clearable junk reclaimed), not
 * the inbox size — so the number next to the price is a win the user can see,
 * not a tax for having a big inbox. Pure module, fully unit-testable.
 *
 * Tier is chosen from clearable bytes measured pre-purchase (deterministically,
 * no LLM). Each tier maps to a Stripe Price ID supplied via env.
 */

export interface PricingTier {
  id: 'tidy' | 'reclaim' | 'major';
  /** Inclusive lower bound in bytes. */
  minBytes: number;
  /** Price in whole dollars (display + sanity only; Stripe is source of truth). */
  priceUsd: number;
  /** Short label shown in the UI. */
  label: string;
  /** Env var holding this tier's Stripe Price ID. */
  envKey: string;
}

const GB = 1024 * 1024 * 1024;

/**
 * Tiers, ordered low→high. Boundaries:
 *   < 2 GB        → $19  "Tidy up"
 *   2 GB – 8 GB   → $29  "Reclaim real space"
 *   ≥ 8 GB        → $49  "Major cleanup"
 */
export const PRICING_TIERS: readonly PricingTier[] = [
  { id: 'tidy',    minBytes: 0,       priceUsd: 19, label: 'Tidy up + rescue your photos', envKey: 'STRIPE_PRICE_ID' },
  { id: 'reclaim', minBytes: 2 * GB,  priceUsd: 29, label: 'Reclaim real space',           envKey: 'STRIPE_PRICE_ID_RECLAIM' },
  { id: 'major',   minBytes: 8 * GB,  priceUsd: 49, label: 'Major cleanup — most storage back', envKey: 'STRIPE_PRICE_ID_MAJOR' },
] as const;

/** Pick the tier for a given clearable-bytes amount (defaults to the lowest tier). */
export function tierForBytes(clearableBytes: number): PricingTier {
  const bytes = Number.isFinite(clearableBytes) && clearableBytes > 0 ? clearableBytes : 0;
  // Highest tier whose minBytes the amount meets.
  let chosen = PRICING_TIERS[0];
  for (const t of PRICING_TIERS) {
    if (bytes >= t.minBytes) chosen = t;
  }
  return chosen;
}

/**
 * Resolve the Stripe Price ID for a tier from env. Falls back to the base
 * STRIPE_PRICE_ID if a higher tier's price isn't configured yet, so the flow
 * never breaks mid-setup (it just under-charges, never errors).
 */
export function priceIdForTier(tier: PricingTier): string | undefined {
  return process.env[tier.envKey] ?? process.env.STRIPE_PRICE_ID;
}

/** Human GB string for the UI, e.g. 4_400_000_000 → "4.1 GB". */
export function formatGb(bytes: number): string {
  if (!bytes || bytes < 0) return '0 GB';
  const gb = bytes / GB;
  if (gb < 0.1) {
    const mb = bytes / (1024 * 1024);
    return `${Math.max(1, Math.round(mb))} MB`;
  }
  return `${gb >= 10 ? Math.round(gb) : gb.toFixed(1)} GB`;
}
