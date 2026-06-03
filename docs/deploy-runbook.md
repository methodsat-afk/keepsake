# Keepsake — Production Deploy Runbook

Everything needed to take Keepsake from localhost to a live site a stranger can
pay for. Steps marked **[YOU]** require your accounts (I can't do them); steps
marked **[CODE]** are already done.

---

## 0. Pre-flight (already done) [CODE]
- ✅ All 6 DB migrations applied to Supabase.
- ✅ `next/image` optimization configured for Supabase Storage (`next.config.ts`)
      — gallery images are now right-sized instead of full-resolution.
- ✅ All API routes auth-gated; webhook deduped; cost circuit-breakers live.
- ✅ `localhost` only ever appears as a `?? 'http://localhost:3000'` fallback —
      overridden in prod by `NEXT_PUBLIC_APP_URL`.

---

## 1. Deploy the app (Vercel recommended) [YOU]
1. Push the repo to GitHub.
2. In Vercel: **New Project** → import the repo → framework auto-detects Next.js.
3. **Do not deploy yet** — set env vars first (step 2), then deploy.
4. Note your production URL (e.g. `https://keepsake.vercel.app` or a custom domain).

---

## 2. Environment variables (Vercel → Project → Settings → Env Vars) [YOU]
Set ALL of these for the **Production** environment. Values come from `.env.local`
except where noted as "CHANGE FOR PROD".

**App**
- `NEXT_PUBLIC_APP_URL` — **CHANGE**: your real prod URL (e.g. `https://keepsake.app`). Critical — OAuth redirects + Stripe URLs use it.

**Supabase** (same as dev — one project)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

**Anthropic**
- `ANTHROPIC_API_KEY` — and set a **monthly spend cap** in the Anthropic console (the 3am-charge backstop).

**Google OAuth**
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

**Stripe** (switch to LIVE keys when you go truly live; test keys are fine for a soft launch)
- `STRIPE_SECRET_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET` — **CHANGE**: new value from the prod webhook (step 4).
- `STRIPE_PRICE_ID` — base $19 tier.
- `STRIPE_PRICE_ID_RECLAIM` — $29 tier. ⚠️ If unset, the $29 tier silently falls back to $19.
- `STRIPE_PRICE_ID_MAJOR` — $49 tier. ⚠️ Same fallback caveat.

**Inngest** — **CHANGE FOR PROD.** Dev uses a local server; prod uses Inngest Cloud.
- Remove/omit `INNGEST_DEV` and `INNGEST_BASE_URL` (these force local-dev mode).
- `INNGEST_EVENT_KEY` — **CHANGE**: from Inngest Cloud dashboard (not "local").
- `INNGEST_SIGNING_KEY` — **CHANGE**: from Inngest Cloud dashboard.

**Nylas** — only if you enable Outlook/Yahoo (Gmail doesn't use it). Can omit for launch.

---

## 3. Google OAuth — redirect URI + verification [YOU]
1. Google Cloud Console → **APIs & Services → Credentials** → your OAuth client.
2. **Authorized redirect URIs** → add: `https://YOUR_PROD_URL/api/auth/google/callback`
   (keep the localhost one for dev).
3. **OAuth consent screen**: while unverified, only **Test users** you allowlist can
   connect. To open to everyone you must submit for **verification** (needs the live
   privacy policy URL — `https://YOUR_PROD_URL/privacy` — homepage, and a demo video).
4. ⚠️ The cleanup-delete feature needs the `gmail.modify` **restricted scope** +
   an annual **CASA security audit** ($5k–75k, months). Until then, keep the
   landing page's deletion copy behind a flag or labeled "coming soon" — the
   dry-run works, but actual deletion isn't live.

---

## 4. Stripe — production webhook [YOU]
1. Stripe Dashboard → **Developers → Webhooks → Add endpoint**.
2. URL: `https://YOUR_PROD_URL/api/stripe/webhook`
3. Events to send: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`.
4. Copy the new **Signing secret** → set as `STRIPE_WEBHOOK_SECRET` in Vercel (step 2).
5. Stripe Dashboard → **Settings → Payment methods** → enable **Apple Pay** + **Google Pay**.
6. If using the tiered prices, confirm all three Price IDs exist in the LIVE
   product (if you switch from test to live keys, recreate the $29/$49 prices live).

---

## 5. Inngest Cloud [YOU]
1. Create an Inngest Cloud account, create an app.
2. Point it at `https://YOUR_PROD_URL/api/inngest` (Inngest → Sync new app).
3. Copy the Event Key + Signing Key → set in Vercel (step 2).
4. Without this, background jobs (scan, classify, measure) won't run in prod.

---

## 6. Deploy + smoke test [YOU + verify]
1. Deploy in Vercel.
2. Visit the prod URL → landing page loads.
3. Sign up → connect Gmail (must be a Google **test user**) → scan runs.
4. Check Inngest Cloud dashboard: `scan-inbox` → `filter-photo` execute.
5. Gallery shows categorized photos (now image-optimized).
6. `/download` → checkout (test card `4242…`) → webhook fires → page flips to paid.
7. Download ZIP → folders are `Category/Year/`.

---

## 7. Post-launch watch-list
- **Anthropic spend** — the monthly cap is your backstop; watch the first real scans.
- **Supabase storage/egress** — image optimization cuts egress a lot; the per-scan
  500-photo cap caps storage. Watch if a whale inbox appears.
- **Stripe** — watch for failed webhooks (the dedup means retries are safe).
- **First real inboxes** — validate AI photo/junk accuracy on non-test data; you've
  only proven it on your own inbox so far.

---

## Quick "what changes from dev → prod" cheat sheet
| Var | Dev | Prod |
|-----|-----|------|
| `NEXT_PUBLIC_APP_URL` | `localhost:3000` | your real URL |
| `INNGEST_DEV` / `INNGEST_BASE_URL` | set (local mode) | **removed** |
| `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY` | `local` / dev | Inngest Cloud values |
| `STRIPE_WEBHOOK_SECRET` | CLI listener secret | prod webhook secret |
| Google redirect URI | localhost callback | prod callback added |
