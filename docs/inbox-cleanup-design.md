# Inbox Cleanup — Technical Design

**Status:** Draft / not implemented. Backend is currently read-only.
**Scope of this doc:** Junk classifier, review UI, and Gmail trash API.
**Blocked on:** `gmail.modify` restricted-scope OAuth verification + annual CASA
security assessment (see §9). Do **not** ship the cleanup marketing copy publicly
until this backend ships and the scope is approved, or it is false advertising.

---

## 1. Goals & non-goals

**Goals**
- After photos are rescued, identify low-value bulk mail ("junk") in the user's inbox.
- Auto-trash only *high-confidence* junk (opt-in); ask the user to approve the rest.
- Only ever move mail to **Trash** (recoverable ~30 days). Never permanently delete.
- Full audit log + one-click "restore everything."
- Surface real storage reclaimed (bytes), since that is the value prop.

**Non-goals (v1)**
- No permanent deletion / `Trash.empty`. (Storage frees when Gmail purges Trash at ~30d,
  or the user empties it manually. We never call destructive delete.)
- No non-Gmail providers (Outlook/Yahoo) — Gmail only.
- No filters/rules creation, no unsubscribe automation. (Future.)

---

## 2. Trust model (drives everything)

| Tier | Criteria | Action |
|------|----------|--------|
| **Auto** | Gmail category is `CATEGORY_PROMOTIONS` or `CATEGORY_SOCIAL` **AND** message has a `List-Unsubscribe` header **AND** classifier confidence ≥ 0.92 **AND** not in a protected sender list | Trashed automatically **only if** user enabled auto-cleanup. Logged; restorable. |
| **Review** | Looks like bulk/clutter but missing one auto signal (e.g. high confidence but no `List-Unsubscribe`, or `CATEGORY_UPDATES`) | Shown in review UI, **unchecked by default** → user opts in per group/item |
| **Protected (never touch)** | `CATEGORY_PERSONAL`/primary, starred, important, has attachment we rescued, sender on an allowlist (banks, gov, tax, legal keywords), or thread the user has replied to | Excluded entirely. Not shown as deletable. |

Auto-cleanup is **opt-in**, defaulting to review-only. This is both the safety mechanism
and the liability posture ("the user enabled this and could undo it").

**Why these signals:** `CATEGORY_PROMOTIONS`/`SOCIAL` + `List-Unsubscribe` is the
near-canonical fingerprint of machine bulk mail. Requiring *all* of category + header +
model confidence means a single false signal demotes a message from Auto to Review, so
a tax doc or personal note never lands in the auto-trash tier.

---

## 3. Data model (new tables)

Mirrors the existing `scans`/`photos` shape (snake_case, `user_id`, RLS, service-role writes).

```sql
-- A cleanup pass, one per "scan for junk" run. Sibling to `scans`.
create table cleanup_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  status text not null default 'pending',          -- pending|scanning|review|applying|complete|error
  emails_scanned integer not null default 0,
  junk_found integer not null default 0,
  auto_enabled boolean not null default false,      -- did the user opt into auto-trash?
  bytes_reclaimed bigint not null default 0,        -- sum(size_estimate) of trashed items
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  error_message text
);

-- One row per candidate message. The audit log + the review UI both read this.
create table cleanup_items (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references cleanup_runs(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  gmail_message_id text not null,                   -- Gmail message id (NOT stored body)
  gmail_thread_id text,
  sender_email text,
  sender_name text,
  subject text,                                     -- header only; we never store body
  internal_date timestamptz,
  size_estimate bigint,                             -- from messages.get sizeEstimate
  gmail_category text,                              -- CATEGORY_PROMOTIONS, etc.
  has_list_unsubscribe boolean not null default false,
  confidence real,                                  -- classifier score 0..1
  tier text not null,                               -- 'auto' | 'review' | 'protected'
  decision text not null default 'pending',         -- pending|approved|skipped|trashed|restored|failed
  trashed_at timestamptz,
  restored_at timestamptz,
  unique (run_id, gmail_message_id)
);

create index on cleanup_items (user_id, decision);
create index on cleanup_runs (user_id, started_at desc);
```

We persist **headers + metadata only** (sender, subject, size, category) — never the email
body — consistent with the privacy policy. `subject` is stored so the review UI is useful and
the audit log is meaningful; flag in privacy policy that subject lines are retained.

---

## 4. Classifier

Reuse the pattern in `src/lib/claude/classify.ts`, but this is **text/metadata**, not vision —
cheaper and faster. New module `src/lib/claude/classify-junk.ts`.

```ts
export interface JunkSignals {
  category: string | null;        // Gmail label e.g. CATEGORY_PROMOTIONS
  hasListUnsubscribe: boolean;
  sender: string | null;
  subject: string | null;
  snippet: string | null;         // Gmail-provided snippet, NOT full body
}
export interface JunkResult { result: 'JUNK' | 'KEEP'; confidence: number; reason: string }
```

**Two-stage, cost-aware:**
1. **Deterministic pre-filter (free, no LLM).** Most decisions never hit the model:
   - Protected category / starred / important / replied-to / rescued-attachment → `protected`, skip.
   - `CATEGORY_PROMOTIONS|SOCIAL` + `List-Unsubscribe` → strong junk prior.
   - Allowlist sender-domain keywords (bank, irs, gov, legal, insurance, receipt-from-known-vendors the user transacts with) → demote to `review` at most.
2. **LLM tie-breaker (Haiku)** only for ambiguous items, batched ~20 subjects/senders per call
   to control cost. Returns `JUNK|KEEP` + confidence + one-line reason (shown in UI as "why").

Final tier = function of (category, header, confidence, allowlist) per the §2 table — the model
**cannot single-handedly** promote something to Auto; the deterministic signals gate it.

Fail-safe: on any classifier error, default to `KEEP`/`review` (mirrors classify.ts defaulting
to JUNK for photos — here the safe default is the opposite: never auto-trash on uncertainty).

---

## 5. Pipeline (Inngest, mirrors scan-inbox → filter-photo fan-out)

New functions under `src/lib/inngest/functions/`:

- **`scan-junk.ts`** (`id: 'scan-junk'`, trigger `keepsake/cleanup.start`)
  - Marks `cleanup_runs.status = 'scanning'`.
  - `gmail.users.messages.list` with a clutter-biased query, e.g.
    `category:promotions OR category:social older_than:1y -is:starred -is:important has:nouserlabels`
    (tunable). Paginate like `scan-inbox` does.
  - Fan out `keepsake/cleanup.item` events per message id.
- **`classify-junk-item.ts`** (`id: 'classify-junk-item'`, trigger `keepsake/cleanup.item`)
  - `messages.get` (format `metadata`, headers: From/Subject/Date/List-Unsubscribe + labelIds + sizeEstimate). **Metadata format only — body is never fetched.**
  - Run §4 classifier → compute tier → upsert a `cleanup_items` row.
  - Increment `cleanup_runs.junk_found` (recompute from table, race-safe, like the
    `photos_found` fix already in `filter-photo.ts`).
  - When fan-out drains, set `status='review'`.
- **`apply-cleanup.ts`** (`id: 'apply-cleanup'`, trigger `keepsake/cleanup.apply`)
  - Input: run id + the set of approved `cleanup_items` ids (auto-tier rows pre-approved iff `auto_enabled`).
  - For each, `gmail.users.messages.trash` (see §6). On success set `decision='trashed'`,
    `trashed_at`, add `size_estimate` to `bytes_reclaimed`. On failure `decision='failed'` (logged, never fatal).
  - Set `status='complete'`.

Gating: cleanup only runs **after** a successful photo rescue + payment (`profiles.has_paid`),
so memories are always safe first. The pipeline reads tokens off the latest `scans` row (already
stores `gmail_access_token`/`refresh_token`).

---

## 6. Gmail trash API

- **Trash:** `POST /gmail/v1/users/me/messages/{id}/trash` → `gmail.users.messages.trash({ userId:'me', id })`.
  Reversible; moves to Trash, frees inbox, counts toward Trash which Gmail auto-purges ~30d.
- **Restore:** `gmail.users.messages.untrash({ userId:'me', id })`. Powers one-click "restore everything."
- **Never** call `messages.delete` or `messages.batchDelete` (permanent) in v1.
- **Scope required:** `https://www.googleapis.com/auth/gmail.modify` (restricted).
  Update `src/app/api/auth/google/route.ts` scope array (currently only `gmail.readonly`).
  `modify` covers trash/untrash without granting permanent-delete (`https://mail.google.com/`).
- **Rate limits:** Gmail per-user quota (~250 units/s; `trash` ≈ 5 units). Batch with small
  concurrency + retry/backoff inside the Inngest step (steps already give us retries).
- **Idempotency:** `cleanup_items.decision` guards re-runs; trashing an already-trashed message is a no-op.

---

## 7. Review UI

New route `src/app/(dashboard)/cleanup/page.tsx` + `CleanupReview.tsx` client component.
OpenServ light theme; deep-blue primary, electric-green for the confirm/convert action.

**Layout**
- Header: "Reclaim your storage" + live "~X GB recoverable" estimate (sum of selected `size_estimate`).
- **Grouped by sender** (collapsible groups, e.g. "Old Navy — 142 emails · 0.8 GB"). Bulk
  select/deselect per group is the primary interaction — nobody reviews 4,000 emails individually.
- Each group shows: sender, count, total size, tier badge (Auto / Needs review), and the
  classifier's one-line reason. Expand to see individual subjects + dates.
- **Auto tier** rendered in a distinct "Will be cleaned automatically" section, pre-checked,
  with an inline toggle to disable auto entirely (writes `cleanup_runs.auto_enabled`).
- **Protected** items shown read-only in a "We'll never touch these" reassurance strip.
- Sticky footer: "Move N emails to Trash · frees ~X GB" (electric-green) + "Cancel."
  Confirm dialog reiterates: *recoverable for 30 days, one-click undo.*

**Post-apply**
- Success screen: count trashed, GB reclaimed, prominent **"Restore everything"** button
  (calls untrash for the run) + link to the audit log. Restore stays available until Gmail purges.

**APIs**
- `GET /api/cleanup/run` — latest run + grouped items for the UI.
- `POST /api/cleanup/scan` — enqueue `keepsake/cleanup.start` (auth + has_paid gated).
- `POST /api/cleanup/apply` — body `{ runId, approvedIds[], autoEnabled }` → `keepsake/cleanup.apply`.
- `POST /api/cleanup/restore` — body `{ runId }` or `{ itemIds[] }` → untrash + mark `restored`.

All routes: `getUser()` auth, service-role DB writes, verify `has_paid`, verify each
`cleanup_item.user_id === user.id` before any Gmail call (no IDOR).

---

## 8. Safety & liability checklist

- [ ] Trash-only; `messages.delete` not imported anywhere (add a lint/CI grep guard).
- [ ] Auto-tier requires category + `List-Unsubscribe` + confidence≥0.92 + allowlist pass + `auto_enabled`.
- [ ] Protected set excluded pre-classification (starred/important/personal/replied/rescued/allowlist).
- [ ] Every trashed item logged in `cleanup_items` with reason; one-click restore per run.
- [ ] Classifier fails safe to KEEP/review.
- [ ] Per-item `user_id` ownership check before each Gmail mutation.
- [ ] Dry-run mode (env flag) that classifies + populates tables but calls **no** trash API,
      for testing the whole flow against a real inbox without touching mail.
- [ ] Rate-limit + backoff; partial failures non-fatal and surfaced.

---

## 9. The blocker: OAuth + CASA (do not under-estimate)

- `gmail.modify` is a **restricted scope**. Google requires:
  1. OAuth app verification (privacy policy, homepage, demo video, scope justification), **and**
  2. An annual independent **CASA** (Cloud Application Security Assessment) — Tier 2 for
     restricted scopes. Cost roughly **$5k–$75k/yr**; lead time **weeks to months**.
- The app is not yet verified even for `gmail.readonly`. Sequence: ship readonly → verify →
  then pursue `modify` + CASA. Until approved, only test users on the OAuth consent screen can
  use cleanup.
- **Product gate:** keep the cleanup marketing copy behind a flag (or labeled "coming soon")
  on the public site until `modify` is live. The copy currently on the landing page describes
  this unbuilt capability.

---

## 10. Build order (incremental, each shippable behind a flag)

1. **Schema** — `cleanup_runs` + `cleanup_items` (+ RLS).
2. **Classifier** — `classify-junk.ts` with deterministic pre-filter; unit-test the tiering table.
3. **Scan pipeline (dry-run)** — `scan-junk` + `classify-junk-item`, no trash calls. Run against a
   real test inbox; eyeball the tiering. This is fully testable **today** on `gmail.readonly`.
4. **Review UI** — read-only first (shows what *would* be cleaned), proving classifier quality.
5. **Scope + CASA** — begin `gmail.modify` verification in parallel with steps 1–4.
6. **Apply + restore** — `apply-cleanup`, trash/untrash APIs, audit log. Gated on scope approval.
7. **Auto-tier opt-in** — last, once review-tier accuracy is proven in the wild.

Steps 1–4 deliver a working, demoable, **non-destructive** cleanup preview with no new OAuth risk.
Steps 5–7 are the regulated, destructive half.
