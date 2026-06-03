-- Add a fixed-taxonomy category to rescued photos for folder-based sorting.
-- See src/lib/photo-categories.ts for the canonical set. Backfills to 'Other'.

alter table public.photos
  add column if not exists category text not null default 'Other';

-- Index so the gallery can filter by category quickly.
create index if not exists photos_user_category_idx
  on public.photos (user_id, category);
