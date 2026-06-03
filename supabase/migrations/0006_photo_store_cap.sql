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
