-- Pre-purchase GB measurement for tiered pricing.
-- clearable_bytes is measured DETERMINISTICALLY (Gmail metadata sizes only, no
-- LLM) so the price can be shown before checkout without API cost. See
-- src/lib/pricing.ts. Lives on profiles so checkout can read it directly.

alter table public.profiles
  add column if not exists clearable_bytes bigint not null default 0,
  add column if not exists clearable_measured_at timestamptz,
  -- The Stripe price tier the user was quoted, captured at checkout time so the
  -- webhook can verify what they actually agreed to pay.
  add column if not exists pricing_tier text;
