# Keepsake — Apply migrations & end-to-end smoke test

A short, repeatable checklist to turn "compiles" into "known-working." Do the
steps in order; each has an explicit pass/fail check.

---

## 0. Prereqs (one-time)

- Dev server running: `npm run dev` → http://localhost:3000
- Inngest dev server running (background jobs won't fire without it):
  `npx inngest-cli@latest dev -u http://localhost:3000/api/inngest`
  (or however it's normally started for this project — port 8288)
- Stripe CLI listener if you'll test payment:
  `stripe listen --forward-to localhost:3000/api/stripe/webhook`

---

## 1. Apply the database migrations  ⚠️ must be done by a human

The agent cannot run DDL (no DB password / psql / dashboard access from the
sandbox; PostgREST can't run DDL). Apply via the Supabase dashboard:

1. Open the SQL editor:
   https://supabase.com/dashboard/project/lxoigvelbxjgdfascjqa/sql/new
2. Paste the entire contents of **`supabase/APPLY_ALL.sql`** and click **Run**.
   (It's migrations `0001` + `0002` combined, and is idempotent — safe to re-run.)

**Pass check** — run these in the SQL editor; all three should succeed:
```sql
select category from public.photos limit 1;          -- column exists (no error)
select count(*) from public.cleanup_runs;            -- table exists → 0
select count(*) from public.cleanup_items;           -- table exists → 0
```

Or from the repo (uses the service key already in `.env.local`):
```bash
bash scripts/verify-schema.sh
```
Expect: `photos.category -> 200`, `cleanup_runs -> 200`, `cleanup_items -> 200`.

> Before applying, the same script shows `400 / 404 / 404` — that's how you know
> the migration was needed.

---

## 2. End-to-end pipeline (one real run)

Sign in at http://localhost:3000/login, then:

1. **Connect Gmail** → `/scan` → pick Gmail → OAuth consent.
   - *Pass:* redirected back to `/scan`, a "scanning" state appears.
   - *Watch:* the Inngest dashboard (http://localhost:8288) — `scan-inbox` runs,
     then `filter-photo` fans out. Logs show `[classify] result=… category=…`.
2. **Photos get categories** — once the scan completes, in the Supabase table
   editor (or SQL): `select category, count(*) from photos group by category;`
   - *Pass:* rows have real categories (People/Travel/…), not all `Other`.
3. **Gallery category chips** → `/gallery`.
   - *Pass:* a category chip row appears; clicking one filters the grid.
4. **ZIP folder layout** → `/download` → **Download ZIP** (requires a paid
   account — see §3 if not paid).
   - *Pass:* unzip → folders are `Category/Year/…`, e.g. `Travel/2019/photo.jpg`.
5. **Cleanup dry-run** → `/download` → **Clean up inbox** → `/cleanup` →
   **Scan for junk**.
   - *Pass:* groups appear by sender with sizes; an "auto" section and a
     "review" section; protected count shown. **No email is trashed** (the apply
     button is disabled/"coming soon" by design).

---

## 3. Payment (if the test account isn't paid yet)

1. `/download` → **Unlock my photos** → Stripe Checkout.
2. Test card `4242 4242 4242 4242`, any future expiry / CVC / ZIP.
3. *Pass:* redirected to `/download?session_id=…`, page flips to "paid"
   (the Stripe CLI window shows `checkout.session.completed → 200`).

---

## 4. Known gates (not bugs)

- **Inbox cleanup cannot actually delete** until the `gmail.modify` scope is
  approved + the CASA security assessment is done. The dry-run is the intended
  current behavior. See `docs/inbox-cleanup-design.md` §9.
- **Categories only populate on NEW scans** run after migration `0002`. Existing
  photos backfill to `Other`. To re-categorize old photos, re-scan.
- App still points at `localhost` (OAuth redirect URIs, `NEXT_PUBLIC_APP_URL`,
  Inngest dev). Production needs those repointed + a prod Stripe webhook secret.

---

## 5. If something breaks

- **Scan does nothing / no photos:** is the Inngest dev server running and
  pointed at `/api/inngest`? Check http://localhost:8288 for failed runs.
- **`category` insert error:** migration `0002` not applied (see §1 pass check).
- **`/cleanup` scan errors with a table error:** migration `0001` not applied.
- **500 after a build:** stale `.next` cache — `pkill -f "next dev"; rm -rf .next;
  npm run dev`.
