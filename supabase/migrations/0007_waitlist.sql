create table if not exists waitlist (
  id         uuid primary key default gen_random_uuid(),
  email      text not null unique,
  created_at timestamptz not null default now()
);

alter table waitlist enable row level security;
-- All access via service role only; no client-side reads or writes.
