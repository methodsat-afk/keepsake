-- Keepsake schema apply — paste this whole file into the Supabase SQL editor.
-- Combines migrations 0001-0004. Idempotent (safe to run more than once).
-- Project ref: lxoigvelbxjgdfascjqa

-- ========== 0001_inbox_cleanup.sql ==========
-- Inbox cleanup: junk → Trash pipeline.
-- See docs/inbox-cleanup-design.md. Non-destructive on its own (schema only).
-- Mirrors the existing scans/photos conventions: snake_case, user_id FK, RLS on,
-- service-role performs writes from trusted server contexts.

-- ── cleanup_runs ─────────────────────────────────────────────────────────────
create table if not exists public.cleanup_runs (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  status          text not null default 'pending'
                    check (status in ('pending','scanning','review','applying','complete','error')),
  emails_scanned  integer not null default 0,
  junk_found      integer not null default 0,
  auto_enabled    boolean not null default false,
  bytes_reclaimed bigint  not null default 0,
  started_at      timestamptz not null default now(),
  completed_at    timestamptz,
  error_message   text
);

create index if not exists cleanup_runs_user_started_idx
  on public.cleanup_runs (user_id, started_at desc);

-- ── cleanup_items ────────────────────────────────────────────────────────────
-- One row per candidate message. Stores headers + metadata only — never the body.
create table if not exists public.cleanup_items (
  id                   uuid primary key default gen_random_uuid(),
  run_id               uuid not null references public.cleanup_runs(id) on delete cascade,
  user_id              uuid not null references auth.users(id) on delete cascade,
  gmail_message_id     text not null,
  gmail_thread_id      text,
  sender_email         text,
  sender_name          text,
  subject              text,
  internal_date        timestamptz,
  size_estimate        bigint,
  gmail_category       text,
  has_list_unsubscribe boolean not null default false,
  confidence           real,
  reason               text,
  tier                 text not null
                         check (tier in ('auto','review','protected')),
  decision             text not null default 'pending'
                         check (decision in ('pending','approved','skipped','trashed','restored','failed')),
  trashed_at           timestamptz,
  restored_at          timestamptz,
  unique (run_id, gmail_message_id)
);

create index if not exists cleanup_items_run_idx
  on public.cleanup_items (run_id);
create index if not exists cleanup_items_user_decision_idx
  on public.cleanup_items (user_id, decision);

-- ── Row-level security ───────────────────────────────────────────────────────
-- Users may read their own rows; all writes happen via the service-role client
-- (which bypasses RLS), matching how scans/photos are written by the pipeline.
alter table public.cleanup_runs  enable row level security;
alter table public.cleanup_items enable row level security;

drop policy if exists "cleanup_runs_select_own" on public.cleanup_runs;
create policy "cleanup_runs_select_own"
  on public.cleanup_runs for select
  using (auth.uid() = user_id);

drop policy if exists "cleanup_items_select_own" on public.cleanup_items;
create policy "cleanup_items_select_own"
  on public.cleanup_items for select
  using (auth.uid() = user_id);

-- ── Race-safe junk_found recompute (mirrors increment_emails_processed) ──────
-- The fan-out classifies many items concurrently; recompute from the source of
-- truth instead of incrementing, so the last writer still reflects the true count.
create or replace function public.recompute_cleanup_counts(run_id_input uuid)
returns void
language sql
as $$
  update public.cleanup_runs r
  set junk_found = (
    select count(*) from public.cleanup_items i
    where i.run_id = run_id_input and i.tier in ('auto','review')
  )
  where r.id = run_id_input;
$$;

-- ========== 0002_photo_category.sql ==========
-- Add a fixed-taxonomy category to rescued photos for folder-based sorting.
-- See src/lib/photo-categories.ts for the canonical set. Backfills to 'Other'.

alter table public.photos
  add column if not exists category text not null default 'Other';

-- Index so the gallery can filter by category quickly.
create index if not exists photos_user_category_idx
  on public.photos (user_id, category);

-- ========== 0003_safety_caps.sql ==========
-- Safety caps: per-run LLM-call budget + kill switch + pre-purchase scan limit.
-- See src/lib/limits.ts and docs/inbox-cleanup-design.md. Idempotent.

-- ── Cleanup run: LLM call budget + cancellation ──────────────────────────────
alter table public.cleanup_runs
  add column if not exists llm_calls integer not null default 0;

-- Allow a 'cancelled' status (kill switch). Drop+recreate the check to add it.
alter table public.cleanup_runs drop constraint if exists cleanup_runs_status_check;
alter table public.cleanup_runs
  add constraint cleanup_runs_status_check
  check (status in ('pending','scanning','review','applying','complete','error','cancelled'));

/**
 * Atomically claim one LLM-call slot for a run, up to `budget`.
 * Returns true if the caller may make an LLM call (and increments the counter),
 * false if the budget is exhausted. Safe under the concurrent fan-out because the
 * UPDATE ... WHERE llm_calls < budget is atomic per row.
 */
create or replace function public.claim_llm_call(run_id_input uuid, budget integer)
returns boolean
language plpgsql
as $$
declare
  updated integer;
begin
  update public.cleanup_runs
    set llm_calls = llm_calls + 1
    where id = run_id_input
      and llm_calls < budget
      and status not in ('cancelled','error');
  get diagnostics updated = row_count;
  return updated > 0;
end;
$$;

/** True if a run has been cancelled (kill switch) — workers check this and bail. */
create or replace function public.is_run_cancelled(run_id_input uuid)
returns boolean
language sql
as $$
  select coalesce(
    (select status = 'cancelled' from public.cleanup_runs where id = run_id_input),
    false
  );
$$;

-- ── Profiles: pre-purchase scan limit ───────────────────────────────────────
-- successful_scans counts only scans that COMPLETED (not started), so our own
-- failures never burn a user's allowance. scan_limit is per-account so support
-- can bump it. Default 2.
alter table public.profiles
  add column if not exists successful_scans integer not null default 0,
  add column if not exists scan_limit integer not null default 2;

/** Atomically increment a profile's successful_scans (called once per completed scan). */
create or replace function public.increment_successful_scans(user_id_input uuid)
returns void
language sql
as $$
  update public.profiles
    set successful_scans = successful_scans + 1
    where id = user_id_input;
$$;

-- ── Photo scan: image-classify budget (images are the pricey LLM calls) ──────
alter table public.scans
  add column if not exists llm_calls integer not null default 0;

/** Atomically claim one image-classify slot for a scan, up to `budget`. */
create or replace function public.claim_scan_llm_call(scan_id_input uuid, budget integer)
returns boolean
language plpgsql
as $$
declare
  updated integer;
begin
  update public.scans
    set llm_calls = llm_calls + 1
    where id = scan_id_input
      and llm_calls < budget;
  get diagnostics updated = row_count;
  return updated > 0;
end;
$$;

-- ========== 0004_clearable_bytes.sql ==========
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


-- ========== 0005_webhook_dedup.sql ==========
-- Stripe webhook idempotency: record processed event IDs so retried/duplicate
-- webhook deliveries can't double-process a payment. Stripe explicitly retries
-- webhooks and may deliver the same event more than once.

create table if not exists public.stripe_events (
  id          text primary key,        -- Stripe event.id (evt_...)
  type        text not null,
  received_at timestamptz not null default now()
);

-- No RLS policies needed: only the service-role webhook handler touches this,
-- and it bypasses RLS. Enable RLS so it's locked to everyone else by default.
alter table public.stripe_events enable row level security;

-- ========== 0006_photo_store_cap.sql ==========
-- Per-scan photo STORAGE cap. Storage + egress cost scales with how many images
-- we keep, so cap how many photos a single scan stores (whale-inbox protection).
-- See src/lib/limits.ts MAX_PHOTO_STORE. Mirrors claim_scan_llm_call.

alter table public.scans
  add column if not exists photos_stored integer not null default 0;

/**
 * Atomically claim one photo-storage slot for a scan, up to `budget`.
 * Returns true if the caller may store another photo (and increments the
 * counter), false if the storage cap is reached. Atomic per-row UPDATE makes it
 * safe under the concurrent filter-photo fan-out.
 */
create or replace function public.claim_photo_store(scan_id_input uuid, budget integer)
returns boolean
language plpgsql
as $$
declare
  updated integer;
begin
  update public.scans
    set photos_stored = photos_stored + 1
    where id = scan_id_input
      and photos_stored < budget;
  get diagnostics updated = row_count;
  return updated > 0;
end;
$$;
