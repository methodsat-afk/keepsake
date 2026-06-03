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
