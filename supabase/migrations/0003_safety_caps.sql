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
