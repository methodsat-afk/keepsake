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
