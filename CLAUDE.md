# VibeVaults — CLAUDE.md

## Project Overview
**VibeVaults** is a B2B SaaS feedback widget platform. Website owners embed `public/widget.js` to collect user feedback and engage clients in real-time chat. Multi-workspace, multi-project, role-based (owner/member/client). Production domain: **vibe-vaults.com**.

## Tech Stack
- **Framework**: Next.js 16.1.4 (App Router, Turbopack) + React 19
- **Styling**: Tailwind CSS v4 + Shadcn/UI (Radix) + Framer Motion + Lucide
- **Backend/DB**: Supabase (PostgreSQL, Auth, Realtime) — Docker locally, Supabase Cloud in prod
- **Auth**: Magic Link (OTP) + Google OAuth + Cloudflare Turnstile for anti-bot
- **Emails**: Resend (transactional + notifications)
- **Payments**: Stripe — 14-day free trial (no card, no Stripe `trial_period_days`; the clock is app-side `profiles.trial_ends_at`), then paid. NO free tier after the trial.
- **Hosting**: Vercel **Pro** plan (since ~Aug 2026). Pro is mandatory, not a nicety: Hobby is "restricted to non-commercial personal use only" and taking Stripe payments is explicitly commercial, and Vercel's DPA covers **Pro and Enterprise only**, so Hobby would leave us with no Art. 28 contract with the host that processes every request. Never downgrade.
- **Proxy**: `src/proxy.ts` (NOT `middleware.ts` — Next.js 16+ paradigm)
- **Analytics**: Vercel Analytics + Speed Insights + PostHog (EU region `eu.i.posthog.com`)
- **Error tracking**: PostHog — client (`PostHogProvider`, `capture_exceptions: true`), server (`instrumentation.ts` `onRequestError`), React boundary (`src/app/global-error.tsx`), widget (`public/widget.js` → `/api/widget/errors` → `widget_errors` table)
- **Tests**: Playwright E2E (`tests/`) — Tests across `access-matrix`, `account-deletion-safety`, `auth-roundtrip`, `dashboard`, `feedback-flow`, `member-departure`, `stripe-checkout`, `trial-expiration` with seed fixtures in `tests/fixtures/`. `marketing-header.spec.ts` pins the auth-aware chrome across all public pages (a break in the "signed in" direction would silently strip both conversion CTAs from logged-out visitors). `widget-network-capture.spec.ts` is the odd one out: a pure logic test that extracts the failed-request capture block straight out of `public/widget.js` and runs it against a stubbed window (no browser/DB/server), so the privacy guarantees on `/docs/widget-data` can't silently regress. `widget-pinning.spec.ts` needs a browser but no DB or dev server: `tests/utils/widget-harness.ts` serves the real `public/widget.js` against stubbed endpoints, covering anchor durability across viewport resizes (the failure mode is a pin drifting away from what it marks) and the on-page pin layer. **Zero retries** on CI and local — a flaky test is treated as a real bug, not noise to paper over. Any describe block that mutates shared owner state (billing, workspace membership) must save it in `beforeAll` and restore it in `afterAll`; missing restoration pollutes every subsequent test file. `global-setup.ts` writes a `.playwright-running` flag file that `src/lib/resend.ts` checks to short-circuit email sends during E2E runs (no dev inbox noise, no Resend quota burn).
- **CI/CD**: GitHub Actions — `deploy-migrations.yml` (DB migrations), `supabase-backup.yml` (backups), `playwright.yml` (E2E).

## Critical Rules
1. **Never mutate production DB** (Supabase Cloud / Stripe) without explicit permission. Migrations deploy via GitHub Actions.
2. **Never delete local Supabase data** without permission.
3. **Always write a short plan before coding**, ask clarifying questions when needed.
4. **No permanent free tier** — a 14-day free trial with no card required, then paid. Do not describe the trial as "paid": nothing is charged during it.
5. **Premium aesthetics required** — never "minimal viable". Polished, vibrant, well-lit UI.
6. **Shadcn cards** should look consistent. All dialogs use the same `AlertDialog` design.
7. **All emails** share the same styling template.
8. **Form validation** via standard React state — no form libraries.
9. **Add comment blocks** at top of complex files: "Main Responsibility" + "Sensitive Dependencies".
10. **Use Context7 MCP** proactively for library/API docs without user asking.
11. **Default terminal**: bash (Linux Mint dev environment).
12. **Next.js 16**: `middleware.ts` → `src/proxy.ts`, Supabase middleware → `src/lib/supabase/proxy.ts`.
13. **No code duplication** beyond ~5 lines — extract a shared helper instead. See the access/role helpers below for the canonical example of why.
14. **Real users exist in production** — the live DB now has registered accounts. Migrations must be backward-compatible (expand/contract), and destructive schema changes need the two-step ship. See "Shipping Safety" below.
15. **Adding a vendor that touches personal data is a stop-and-check.** Before wiring up any new third party that stores, receives, or processes user or end-user data (a queue, a CDN for uploads, a support tool, an AI API, a monitoring service), you MUST warn the user that it is a new **sub-processor** and that three things have to happen *before* it goes live: (a) give existing customers advance notice so they can object, which is promised in ToS section 8, (b) add it to the sub-processor list in `/privacy-policy` section 7, (c) add it to `/terms-of-service` section 11. Do not silently add the dependency and mention it afterwards. The user has explicitly asked to be warned about this because it is easy to forget.

## Shipping Safety (urgent-fix checklist)
Vercel deploys are atomic and zero-downtime, so shipping while users are active is generally safe. Before pushing, confirm the change isn't one of these:

- **DB migrations** — the only category that can actively break live traffic. Use expand/contract: add column → deploy code that writes both shapes → backfill → deploy code that reads new → drop old. Never couple a destructive migration (drop/rename/NOT NULL without default) to a single deploy. Runs via `deploy-migrations.yml`.
- **Widget API contract (`/api/widget/*`)** — treat as a public append-only API for anything load-bearing. Add fields, never remove/rename; breaking changes need a versioned path (`/api/widget/v2/...`).
  - **Widget cache reality**: `public/widget.js` is served `cache-control: public, max-age=0, must-revalidate`, and Vercel purges the edge copy on every deploy. So browsers do *not* hold stale copies for days — they revalidate on every page load and pick up the new file immediately. The only stale runtime is a tab left **open across the deploy**, still running the old script in memory.
  - That narrows the real risk: renaming or removing a widget endpoint only hurts already-open tabs. For a **fire-and-forget** call (telemetry, error beacons) whose failure is swallowed by `.catch()`, ship the rename with no alias. For anything a user's action depends on (feedback submit, reply, upload, SSE, identity exchange), still keep the old path alive — an open tab hitting a 404 there is a visible failure.
- **Server action signatures** — Next.js hashes server-action IDs; a dashboard tab opened before the deploy can 500 on click. Self-heals on refresh. Avoid during peak if the action is hot.
- **Stripe webhook / cron endpoints** — safe to deploy mid-run; Stripe retries, and `email_digest_queue.sent_at` makes the digest cron idempotent.
- **SSE (`/api/widget/stream`)** — active chats reconnect onto the new build. Safe unless the stream contract changed.

**For an urgent fix**: if it's scoped to a single dashboard route, component, or server-side bug with no schema or widget-API touch, ship it. If it touches `supabase/migrations/` or `/api/widget/*`, stop and plan the two-step.

## Legal & Compliance
Operator is a Hungarian sole trader (egyéni vállalkozó, "e.v."), so the legal entity is a natural person, not a company. Never sign or name "VibeVaults" as the contracting entity.

- **`src/lib/legal-entity.ts`** is the single source of truth for the operator's identity (name, legal form, registration number, tax number, seat). It is rendered by **both** `/privacy-policy` section 1 and `/terms-of-service` section 1. Never hand-copy these values into a third place.
- **`/privacy-policy`** doubles as the GDPR Art. 13 notice. Section 3.2 must mirror what `getMetadata()` in `public/widget.js` actually captures, and `/docs/widget-data` must mirror it too. Those three move together.
- **`/terms-of-service` section 8** carries the Art. 28 processor terms. `/privacy-policy` section 4 points at it and calls it half of the DPA, so that section cannot be removed or renumbered without breaking the claim.
- **`docs/records-of-processing.md`** — Art. 30 ROPA. Internal, never published. Update when a new data category, sub-processor, or retention period appears.
- **`docs/dpa-checklist.md`** — evidence that every sub-processor is actually under a DPA, as both public policies assert.
- **`docs/data-breach-response.md`** — the 72-hour procedure. Key fork: for **feedback** data we are the processor, so we notify the affected customer, not NAIH.

## File Structure
```
src/
  actions/          # Server Actions (feedback.ts, onboarding.ts, workspaces.ts, etc.)
  app/
    api/            # API routes (widget/, stripe/, auth/, workspaces/, projects/)
    auth/           # Auth pages (login, register, callback, confirm)
    dashboard/      # Dashboard pages (feedback, project-settings, settings, account, subscribe)
    docs/           # Public customer documentation (index + 7 pages, driven by lib/docs-data.ts)
    share/          # Public read-only board sharing
    page.tsx        # Landing page
  components/       # React components (feedback-card, AppSidebar, Onboarding, etc.)
  hooks/            # Custom React hooks
  lib/
    supabase/       # admin.ts, client.ts, server.ts, proxy.ts
    notifications.ts
    notification-prefs.ts
    resend.ts
    stripe.ts
    widget-helpers.ts
    utils.ts
supabase/
  migrations/       # All DB migrations (SQL)
  seed.sql
public/
  widget.js         # Embeddable widget script
tests/              # Playwright E2E tests
```

## Key Architecture Details

### Workspace / Project Hierarchy
- Users auto-get a workspace on signup (DB trigger `handle_new_workspace_for_user`) — skipped for member-invite users
- **14-day trial starts on first-owned-workspace creation**, not at signup. Both `handle_new_workspace_for_user` (auto-create path) and the `create_workspace` RPC (manual path) set `profiles.trial_ends_at` via `UPDATE ... WHERE trial_ends_at IS NULL`. Members who never own a workspace have `trial_ends_at = NULL` and no trial clock running.
- `workspace_members` table: roles are `owner` and `member` only. `'client'` is blocked by `CHECK (role <> 'client')` (migration `20260506000001`) — clients live in `workspace_invites` + `widget_identities` and never get an `auth.users` row. Composite key `(workspace_id, user_id)`; there is no `id` column.
- Cookie-based state: `selectedWorkspaceId`, `selectedProjectId`
- Invites auto-accepted in `dashboard/layout.tsx` on login. After auto-accept, workspaces are re-fetched via the **admin client** (not user-scoped) because Next.js Request Memoization would dedupe the second user-scoped query and return the pre-insert snapshot.

### Invite Flow (deferred account creation)
- Invite emails link to `/auth/accept-invite?token=<invite_id>` — **no auth.users row is created at invite time**. The account is provisioned only when the invitee actively signs in (magic link or Google OAuth). This is a GDPR win over the old `supabase.auth.admin.generateLink` approach, which pre-created accounts before consent.
- Accept-invite page handles four states: (a) auto-accept when the logged-in user's email matches, (b) sign-in surface for guests, (c) email-mismatch (with sign-out button), (d) invalid/expired invite.
- `acceptInvite()` in `src/actions/invites.ts` gates membership creation on email match. Uses admin client because the invitee has no RLS access to `workspace_invites` yet. Duplicate membership (`23505`) is treated as success.
- The invite ID (UUID v4) doubles as the token — unguessable and the email-match check on accept prevents hijacking.

### Access & Role Helpers (single source of truth)
- **Subscription/trial gate**: use `hasActiveAccess(profile)` from `src/lib/tier-config.ts` (re-exported from `tier-helpers.ts`). Do NOT re-derive `isSubscribed || isTrialActive` inline — every new gate must route through this helper. `isTrialExpired(tierInfo)` is the canonical "trial ran out" check.
- **Workspace role checks**: use `src/lib/role-helpers.ts` — `isWorkspaceOwner(supabase, userId, workspaceId)` for async lookups (API routes, server actions) and `isOwnerInMembers(members, userId)` for pure derivations against an already-fetched members list (server components). No more inline `membership.role !== 'owner'` or `.some(m => m.role === 'owner')`.
- Why: these gates are cross-cutting concerns. Duplicated checks drift and produce security/revenue bugs; centralising means one fix = all sites updated.

### Pricing & Tiers
- Three tiers: **Starter $29/mo, Pro $49/mo, Business $149/mo**, with yearly billing at `YEARLY_DISCOUNT = 0.20` (20% off). `profiles.subscription_tier` is `'starter' | 'pro' | 'business'` (null = trial / no subscription).
- **`src/lib/tier-config.ts` is the single source of truth** for limits, display prices, and Stripe price/product IDs (from env vars). It has no server-only imports, so it's safe in both client and server components.
- **`src/lib/tier-helpers.ts`** enforces limits: `getUserTier()`, `getWorkspaceOwnerTier()`, `checkWorkspaceLimit()`, `checkProjectLimit()`, `checkMemberLimit()`, `checkStorageLimit()`.
- **Limits are account-wide, not per-workspace** — project counts sum across every workspace a user owns.
- Error messages are context-aware: owners see "Upgrade to add more", members see "Ask the owner to upgrade".
- Stripe Customer Portal (`/api/stripe/portal`) handles upgrade/downgrade/cancel, including subscription schedules for end-of-period downgrades. Checkout redirects there instead of creating a duplicate subscription.
- The webhook auto-enforces limits on downgrade: disables public sharing, reverts `email_frequency` to `digest`.
- Tier-gated features: widget branding (`showBranding` from `validateApiKey()`) and share boards (gated in both `toggleProjectSharing()` and `/share/[token]`).
- `/dashboard/subscribe` is a server component with context-aware copy (trial expired / trial active with days left / already subscribed). Price IDs are passed from the server, never client env vars.

### Onboarding
- Role-specific checklist in `src/components/onboarding.tsx`, backed by `profiles.completed_onboarding_steps` (text array) and `has_onboarded`.
- **Owners see 8 steps**: create project, share or embed project (spotlights the review-link + embed cards together via `#share-or-embed`), invite members, invite clients, create feedback, customize workspace, customize project, share board. **Members see 5 steps** (same minus the workspace-level ones). Step definitions live in `src/lib/onboarding-steps.ts`.
- **Create Project dialog** (`create-project-dialog.tsx`) doesn't close on create: it shows a success step with the project's shareable review link (copy button) and a pointer to the embed snippet.
- `has_onboarded = true` only when all items are checked. Steps are tracked manually — the old auto-check feature was removed.
- Dismissible into a persistent mini-banner (collapsed state in `localStorage`) with a Resume button. "Go" links navigate to anchor-highlighted target cards via the `Highlight` component.
- Members who create their first workspace get onboarding reset to show the owner checklist.

### RLS Security Pattern
- Use `SECURITY DEFINER` helper functions to avoid infinite recursion (42P17):
  - `get_user_workspaces()` — workspace IDs for current user
  - `get_user_owned_workspaces()` — owned workspace IDs
  - (`get_client_project_ids()` was **dropped** in migration `20260506000001` along with the client RLS clauses — client-facing data now flows through the widget API using the admin client, not RLS.)

### Widget Flow (invite-only, token-based)
- `public/widget.js` → API routes at `/api/widget/*`
- **Visibility**: anonymous visitors see *nothing* — `host.style.display = 'none'` until a valid widget identity is loaded. The legacy "type your email" prompt is gone.
- **Bootstrap (clients)**: invite emails point at `${project.website_url}?vv_invite=<workspace_invites.id>`. On first load, widget.js POSTs the invite ID to `/api/widget/identity/exchange`, receives a per-device opaque token, and stores it in first-party `localStorage[vv_token_${apiKey}]`. The URL param is stripped via `history.replaceState` so it doesn't leak via referrer/share. Multi-device by design — multiple `widget_identities` rows per (project, email) are allowed.
- **Terminology (Atarim-style, used in docs and UI copy)**: **Guests** are people who self-identify via the shareable review link (`via_review = true`); **Clients** are individually email-invited from the dashboard (`workspace_invites` role `client`). Same widget experience; guests are pause-managed as a group, clients are revocable per person. Members always require an auth account; today they are email-invited only. (Atarim additionally offers a shareable member-invite link that routes to registration and consumes seats — a candidate feature for us, see "share this link to invite new members" in their invite modal.)
- **Bootstrap (review link, no invite — hosted entry point)**: every project has a permanent `projects.review_token` (minted by DB default, **never rotated or disabled** — category standard, see Atarim/Huddlekit/Pastel). The shareable link is `vibe-vaults.com/review/<review_token>` (`hostedReviewUrl()` in `src/lib/review-url.ts`), a page **we** host (`src/app/review/[token]/`, public in proxy.ts): the guest enters name + email in a **plain server-rendered form** that POSTs to `/api/review/redeem` (logic in `src/lib/review-redeem.ts`, rate-limited per IP), a `widget_identities` row is minted with `via_review = true` + `display_name`, and the route handler answers with a **303 to `${website_url}?vv_token=<raw>&vv_key=<api_key>`**. Two deliberate choices there: it is a route handler, not a server action, because Next.js blocks server-action redirects to external hosts (host-header check); and the form has **no client-side submit handler**, because a guest clicking before hydration would native-submit and silently reload the page (this actually happened on WebKit). The flow works with JavaScript disabled entirely, pinned by a `javaScriptEnabled: false` spec. Errors come back as `/review/<token>?error=<code>` and render inline. `vv_key` makes widget.js remap its API key past a stale embed-snippet key (`vv_apikey_<embedKey>` in localStorage; a bare `vv_token` clears the remap). The hosted page fails helpfully instead of silently: invalid token, lapsed owner (via `checkOwnerAccess`), or `projects.widget_last_seen_at IS NULL` (widget never loaded on the site — stamped by widget config GET) each render a notice instead of the gate. The dashboard withholds the copyable link on the same signal: `ReviewLinkCard` shows an unlock-after-embed notice and the create-project success dialog points at embedding instead of showing a link, so a not-yet-working URL can't be shared. (The pre-hosted `?vv_review=` widget param was removed entirely — it never had real users.) Guest email is self-declared/unverified; their name is injected server-side into `feedbacks.metadata.sender_name`. The one management control is **pause** (`projects.review_feedback_paused`, action `setReviewFeedbackPaused`): paused review identities can still read everything but every write route returns 403 `{ code: 'review_paused' }` — widget.js matches on that `code` (contractual, append-only) to flip into its paused UI **instead of treating the 403 as token revocation**, which would wipe the guest's identity. Invited clients and members are never affected by the pause. Specs: `tests/review-entry.spec.ts` (hosted page, real API, incl. the no-JS guarantee), `tests/widget-review-link.spec.ts` (widget params + pause, harness).
- **Click-before-hydration is a real failure mode on this product**, not a test artifact: guests and customers land on cold pages, and a click that beats React leaves a button silently dead. Prefer a plain form + route handler where the flow allows it (the review gate). Where a real click handler is unavoidable — `EmbedWidgetCard`'s "Open widget on site" must call `window.open` synchronously or the popup blocker eats it — keep the control **disabled until mounted** so the dead click is visible rather than swallowed.
- **Bootstrap (owners/members)**: dashboard's `EmbedWidgetCard` has an "Open widget on site" button. Click → server action `issueSelfWidgetLink()` → fresh `widget_identities` row tied to `user_id` → returns `${project.website_url}?vv_token=<rawToken>`. Widget.js plants the raw token directly (no exchange round-trip).
- **Authorization on every API call**: `Authorization: Bearer <token>` header (or `?token=` query param for SSE which can't send custom headers). `authenticateWidgetRequest()` in `widget-helpers.ts` resolves API key + Bearer in one shot, returning `{ project, ownerTier, identity }`. `identity.email` is the source of truth — clients can't claim arbitrary senders.
- **Revocation**: deleting a `workspace_invites` row cascade-deletes all client `widget_identities`; removing a `workspace_members` row triggers `revoke_widget_identities_on_member_removal()` which clears the user's identities for that workspace's projects. Widget self-hides + clears localStorage on any 401/403.
- **Clients no longer have `auth.users` rows.** They exist only as `workspace_invites` (role=`'client'`) plus `widget_identities`. The legacy `accept-invite` page rejects client invites with a `ClientInviteView` recovery message. A `CHECK (role <> 'client')` constraint on `workspace_members` prevents accidental promotions.
- **Auto-bootstrap on project creation**: `POST /api/projects` now mints a fresh `widget_identities` row per workspace member (with `?vv_token=`) and reuses each client invitee's persistent ID (with `?vv_invite=`), embedding the resulting URLs in their respective project-created emails. Recipients click once per device to plant the token in `localStorage` and the widget renders.
- **Public recovery page at `/access`**: invitees and members who lose their localStorage can enter their email and receive an emailed list of bootstrap links across every project they have access to. Rate-limited per IP and per email; always returns a generic confirmation regardless of whether the email is on file. Action: `requestWidgetAccessRecovery()` in `src/actions/widget-access.ts`. Excluded from auth gate in `src/lib/supabase/proxy.ts`.
- **Pinned feedback (the widget's only capture path)**: every report from the widget is anchored to a point on the page. Clicking anywhere drops a pin and opens a composer beside it; the panel in the corner holds the feedback list and threads. There is no unpinned "New" form any more — unpinned reports come from the dashboard.
  - **Anchor durability** — a pin is never stored as a raw coordinate. `resolveAnchor()` picks the element under the cursor, or, when that is a full-width layout wrapper, the nearest content-sized element within 240px (`pickAnchorElement`). The offset is recorded **per axis relative to the nearest edge**: `{ ref: 'start' | 'end' | 'pct', d }`. `pct` scales with a fluid element; `start`/`end` keep a fixed pixel gap to an element the pin sits beside. Measuring everything from the top-left instead slides a pin off a left-aligned button as the viewport narrows, which is the bug this shape exists to prevent.
  - **Selectors are never class chains.** `buildSelector()` prefers a stable `#id`, then `data-testid`-style hooks, then a verified-unique `nth-of-type` path. Utility-class strings get rewritten by the very restyle the pin is reporting.
  - **Controls**: opening the widget shows a two-button bar. **Pin** arms placement for exactly *one* pin and disarms as soon as the composer opens — the overlay swallows page clicks, so leaving it armed would make the customer's site unusable. **Feedback** toggles the list panel open/closed; the panel is only as tall as the bar until it is opened. While placement is armed the launcher and panel are hidden (`.pin-placing`) so the widget's own chrome cannot cover the spot being pinned; the instruction and Cancel move onto the overlay banner. Existing pins stay visible as context. There is no persisted Browse/Feedback mode any more: **collapsing the widget is what hides the pins and hands the site back**, and pins render only while it is open.
  - **Pins render on the live page**, matched on origin + pathname (query and hash ignored). Overlapping pins cluster into a count badge that fans out on click. A pin whose anchor element is gone falls back to stored document coordinates and renders grey/dashed as `approximate`.
  - A submitted pin is inserted optimistically and preserved by `fetchAllFeedback()` until the server echoes it back, so it cannot blink out on read-after-write lag.
- **Session context captured with each report** (`getMetadata()` in `public/widget.js`): page URL, UA, screen/viewport, language, the pin `anchor` + `page_key`, plus two buffers rendered in the feedback detail sheet:
  - **Console logs** — rolling 50-entry buffer from monkey-patched `console.log/warn/error`.
  - **Failed requests** — `window.fetch` and `XMLHttpRequest` are wrapped to record non-`ok` responses and network rejections as `type: 'network'` entries. Only failures; successes are ignored. Capped at 15 distinct entries, deduped by `method + url + outcome` so a retry loop can't evict the console logs. Wrapped calls always return/rethrow so the host page is never affected, and the patch is guarded by `window.__vvNetworkPatched` against double-embedding.
  - **Privacy — query strings are stripped client-side before the entry exists.** Only `origin + pathname` is recorded, because host-site query strings routinely carry reset tokens, `access_token`, and end-user emails that we must not store (we are the customer's GDPR processor). Email-shaped path segments become `[redacted]`; segments over 64 chars are truncated; the whole URL is capped at 300. The widget's own `/api/widget/*` traffic is excluded so our noise never pollutes a customer's bug report. Rationale is public at `/docs/widget-data` (linked from the console-logs sheet) — send customers there when they ask where the query strings went.
- Feedback submission: `POST /api/widget`
- Real-time replies: SSE via `/api/widget/stream` + Supabase Realtime
- **Rate limiting**: 30 req/min per IP on all widget endpoints (`src/lib/widget-helpers.ts`), auto-cleaning expired entries every 5 min
- **Content limit**: 5000 chars max for feedback/reply content
- **Completed feedback is hidden from the widget** — `/api/widget/feedback` applies `.neq('status', 'completed')`, so the widget only shows `open`, `in progress`, `in review`
- **Unused-token cleanup**: nightly pg_cron job (migration `20260509000000`) deletes `widget_identities WHERE last_used_at IS NULL AND created_at < now() - interval '30 days'`. Active sessions are never touched.
- **Trial gate**: `validateApiKey()` checks owner's subscription/trial status — widget disabled post-trial
- **File uploads (presigned URL flow)**: Uploads bypass Vercel serverless functions entirely to avoid Vercel's 4.5MB serverless function request body limit (a platform limit on every plan, not a Hobby restriction). Two-step flow: (1) `/api/widget/upload` or `/api/dashboard/upload` validates auth + returns presigned Supabase Storage URLs, (2) client uploads directly to Supabase Storage via PUT, (3) `/api/widget/upload/confirm` or `/api/dashboard/upload/confirm` verifies actual file size/type from storage metadata and creates `feedback_attachments` records. 10MB/file, 10 files/request.
- **Email safety**: All user content in emails sanitized via `esc()` in `lib/notifications.ts`

### Auth Cookie Size & Realtime
- **`cookies.encode: 'tokens-only'`** on all three Supabase client factories (`client.ts`, `server.ts`, `proxy.ts`). Stores only access + refresh tokens in the cookie, dropping `user_metadata`, `identities`, `app_metadata`, and `provider_token`. Without this, Google OAuth metadata bloats cookies to ~5KB+, causing HTTP 431 on Realtime WebSocket upgrades (Kong rejects oversized headers).
- `@supabase/ssr` pinned to exact `0.8.0` because `encode` is `@experimental`.
- `cookie` package is a direct dependency (parse/serialize for browser client's `getAll`/`setAll`).
- `client.ts` provides explicit `auth.userStorage` (SSR-safe) because the library accesses `window.localStorage` unconditionally when `encode: 'tokens-only'` is set.
- **Never use `getSession()` to read `session.user.*`** — it will be empty. Use `getUser()` (server round-trip) or `getClaims()` (JWT decode) instead.

### Observability & Error Tracking
- **PostHog** for product analytics + error capture. Client-side exceptions auto-captured via `PostHogProvider` (`capture_exceptions: true`). Server-side errors captured via `instrumentation.ts` `onRequestError` hook using `posthog-node`. React render errors caught by `src/app/global-error.tsx`.
- **Widget error reporter** (`public/widget.js`): captures `window.error` (filtered to `widget.js` frames) and `unhandledrejection`. Posts to `/api/widget/errors` via `navigator.sendBeacon` (fetch fallback). Per-session deduplication so one bug doesn't flood the table. Stored in `widget_errors` table.
- **Widget screenshot telemetry** (`/api/widget/capture-info`): every screenshot capture (success or failure) POSTs browser, UA, GPU vendor/renderer (via `WEBGL_debug_renderer_info`), DPR, viewport, and duration. Forwarded to PostHog server-side as `widget_screenshot_capture` event. Purpose: size the impact of the known Firefox+GPU foreignObject rasterization bug (see below) so we can decide whether the canvas-substitute workaround is worth its quality tradeoff. Uses a plain `fetch` (not `navigator.sendBeacon`) on a deliberately non-analytics-shaped path: ad blockers drop third-party beacons and `-event` paths, and a blocked request prints `ERR_BLOCKED_BY_CLIENT` in the host site's console. Renamed from `/api/widget/screenshot-event` (removed, no alias) — safe because the beacon is fire-and-forget and `widget.js` revalidates on every load, see "widget cache reality" in Shipping Safety.
- **Known browser bug — Firefox foreignObject rasterization**: snapdom serializes the DOM into an SVG `<foreignObject>` and rasterizes it via `<img>`+canvas. On certain Firefox + GPU/driver combos with hardware acceleration enabled, Firefox's accelerated foreignObject paint **drops `background-color` fills on small pill-shaped elements** (`rounded-full` with non-transparent bg + box-shadow), leaving a ghost silhouette where the box-shadow rendered but the fill and inner text didn't. Confirmed via raw-SVG diagnostic that snapdom serializes correct markup; the bug is purely in Firefox's GPU rasterization step. **End-user workaround**: disable Firefox HW acceleration (`about:preferences` → Performance → uncheck "Use hardware acceleration"). **Code workaround**: not currently shipped — a canvas-substitute pre-pass would degrade screenshot fidelity for 100% of users to fix it for an unknown small minority. Decision deferred until telemetry sizes the problem. Affects all foreignObject-based libraries (`html-to-image`, `dom-to-image`, `modern-screenshot`); only `html2canvas`-family libraries sidestep it but at significant fidelity cost on modern CSS.
- **Admin signup alerts**: DB trigger `trg_queue_admin_new_signup` inserts an `admin_new_signup` row into `email_digest_queue` on new profile insert. The existing `/api/cron/digest` job drains it and emails `ADMIN_EMAIL` via Resend. No HTTP from Postgres, no shared secret — replaced the old pg_net + `SIGNUP_NOTIFY_SECRET` flow which broke silently when the Postgres GUC was unset on Supabase Cloud.

### Notification System
- DB triggers: `notify_new_feedback`, `notify_new_reply`, `notify_project_created`, `notify_project_deleted`, `trg_queue_admin_new_signup`
- In-app: `GlobalNotificationProvider` + `NotificationBell` via Supabase Realtime
- Email: Resend via `lib/notifications.ts` with per-user preferences
- **Email digest system** (`src/lib/email-digest.ts`):
  - Feedback emails: 15-min digest window per recipient per project (first email immediate, subsequent queued)
  - Reply emails: 10-min cooldown per recipient per feedback thread
  - `email_digest_queue` table tracks sent/pending emails
  - Cron endpoint `/api/cron/digest` (every 15 min via Supabase pg_cron + pg_net) processes queued items into batch digest emails
  - `email_preferences.email_frequency`: `'digest'` (default) or `'realtime'` (future paid tier)
  - **Localhost**: all email preferences default to off — no dev email noise
  - **Self-notification prevention**: reply emails never sent to the person who wrote the reply
  - Resend batch API used for multi-recipient digest sends

### Public Documentation (`/docs`)
- Customer-facing docs at `/docs`: `quick-start`, `pinning`, `widget-access`, `screenshots`, `widget-data`, `roles-and-sharing`, `troubleshooting`.
- **`src/lib/docs-data.ts` is the single source of truth** for the page list, titles, and order. It drives the docs index, the sidebar nav (`components/docs/docs-nav.tsx`), the "next page" card (`docs-page-footer.tsx`), the footer's Docs column, and `sitemap.ts`. Adding a page = add a slug there + create `src/app/docs/<slug>/page.tsx`. A slug with no matching directory ships a 404 into the nav and the sitemap — there is no runtime check.
- Shared chrome lives in `src/app/docs/layout.tsx` (SiteHeader + sticky sidebar + SiteFooter); prose styling is the `.docs-prose` class in `globals.css`, so pages stay semantic HTML with no repeated Tailwind strings.
- Pages assert real product behaviour and go stale silently, so anything derivable is derived: `roles-and-sharing` **reads** `TIER_DISPLAY`/`TIER_LIMITS`/`YEARLY_DISCOUNT` from `tier-config.ts` and never restates a price or limit in prose. The remaining hand-written couplings: `screenshots` mirrors the Firefox foreignObject bug entry; `widget-data` mirrors what `getMetadata()` captures; `quick-start` mirrors the embed snippet from `embed-widget-card.tsx`.
- Deep links from the product: the feedback detail console-logs sheet links `/docs/widget-data#query-strings`, and troubleshooting links `/docs/screenshots#firefox-bug`. Keep those anchors stable.
- **`SiteHeader` / `SiteFooter` are the shared chrome for every public page** — landing, `/pricing`, `/compare/*`, `/docs/*`, `/privacy-policy`, `/terms-of-service`. Do not hand-copy a header into a new page; `/pricing` carried a near-duplicate for months and that is exactly why signed-in customers were still shown "Get Started" there.
- **`SiteHeader` is auth-aware** (`src/components/landing/site-header.tsx`): an async server component that resolves the session with `getClaims()` and renders a **Dashboard** button instead of Sign In / Get Started, so signed-in customers are not asked to register again. `<SiteHeader minimal />` renders the wordmark alone and is used on `/access`, whose audience is largely invited clients who by design never get an account — a Sign In button there points them at a signup that cannot solve their problem. Server-side resolution costs nothing because **every route is already dynamic** — the root layout reads `headers()` for the GDPR country check (`layout.tsx`). If that ever changes and marketing pages become statically generated, this header must move to a client-side session check or it will pin them dynamic.
- Dashboard users reach the docs from the **"Questions or Problems?"** card on `/dashboard` (opens `/docs` in a new tab), not from the sidebar.
- **Docs are deliberately NOT in the top nav.** Landing-page nav is conversion real estate (Features / How it works / Pricing / Sign in / Get started) and competitors in this category keep docs out of it too. Discovery is via the footer's Documentation column, the landing FAQ, and in-product deep links.
- The landing FAQ ("What does the widget collect from my client's site?") summarises `widget-data` and links to it. FAQ answers feed the FAQPage JSON-LD from the same array, so edit the array, never the schema separately.

### Dashboard Behaviours
- **Pin surfacing on feedback detail**: a pinned report shows a **Pinned On** tile with the anchor selector, its offset from that element, and a confidence read from `anchor.selectorKind`. `describeAnchorOffset()` / `describeAnchorConfidence()` in `src/lib/feedback-utils.ts` are the single source for that phrasing. Only `ambiguous` is toned as a warning — most real elements have no id, so flagging every `structural` path would make almost every pin look broken. Reports with a bare `metadata.dom_selector` and no anchor (dashboard-created, or predating pinning) still render the legacy **Target Element** tile.
- **Notification navigation**: `src/lib/notification-navigation.ts` is the shared helper used by both the bell dropdown and toast clicks. It looks up the target project's `workspace_id`, writes both `selectedWorkspaceId` and `selectedProjectId` cookies, then routes — so sidebar context follows the notification instead of staying on the previously selected workspace.
- **Deleted feedback doesn't 404**: `src/components/feedback-deleted-toast.tsx` renders a toast instead, driven from the feedback detail page.
- **Project deletion**: members (not just owners) can delete projects in their workspace. `deleteProjectAction` cleans up storage via `cleanupProjectStorage()`, notifies all other members with the deleter's name attributed, and queues digest email. `email_digest_queue.project_id` is nullable so deleted projects can still be referenced.
- **Account deletion**: also removes the user's `email_preferences` row (keyed by email, not `user_id`) to avoid orphans, and `delete-account-card.tsx` clears localStorage and all cookies before redirect so stale session data can't bleed into a later signup on the same browser.
- **Unsaved-changes warnings**: `workspace-settings-card.tsx` and `edit-project-card.tsx` warn before navigating away. Note `beforeunload` alone does not block Next.js `<Link>` navigation.
- **Member departure notification types**: `member_revoked` (owner revokes member) and `member_left` (member leaves), each firing both a bell notification and an email. The workspace switcher hides entirely when a member has no workspaces left.
- **Email opt-out**: `unsubscribeFooterLink()` / `unsubscribeHeaders()` in `lib/notifications.ts` are the single source for the footer link and the RFC 8058 `List-Unsubscribe` + `List-Unsubscribe-Post` headers (Gmail/Yahoo bulk-sender requirement; needs no Resend dashboard config). The header points at `/api/unsubscribe`, a route handler because a Server Component page cannot answer POST: POST turns every `notify_*` off and returns 200, GET hands off to the `/unsubscribe` page.
- **Email templates**: all transactional emails share one style, branded with `public/avatar.jpg` and a "reach out to support@vibe-vaults.com" footer. `scripts/send-welcome.ts` sends the welcome email manually.

## Key Components
| Component | Path | Purpose |
|---|---|---|
| `onboarding` | `src/components/onboarding.tsx` | Role-specific onboarding checklist with collapse/expand |
| `create-project-dialog` | `src/components/create-project-dialog.tsx` | Shared project creation dialog (switcher + onboarding) |
| `highlight` | `src/components/highlight.tsx` | Wraps cards with an ID, pulsating highlight on hash navigation |
| `feedback-list` | `src/components/feedback-list.tsx` | Feedback grid with status filter (hides Completed by default) |
| `feedback-card` | `src/components/feedback-card.tsx` | Feedback detail with real-time chat, status, replies, attachments |
| `app-sidebar` | `src/components/app-sidebar.tsx` | Main dashboard sidebar; tier badge gated on `ownsAnyWorkspace` |
| `project-switcher` / `workspace-switcher` | `src/components/` | Sidebar dropdowns with create option |
| `user-management` | `src/components/user-management.tsx` | Users page: member list, invite form, leave/revoke |
| `global-notification-provider` | `src/components/global-notification-provider.tsx` | Realtime notification context + unified toast |
| `notification-bell` | `src/components/notification-bell.tsx` | Header dropdown, live updates, type icons, `clearAll()` |
| `embed-widget-card` | `src/components/embed-widget-card.tsx` | Widget embed snippet + "Open widget on site" |
| `share-project-card` | `src/components/share-project-card.tsx` | Public board sharing with token management |
| `review-link-card` | `src/components/review-link-card.tsx` | Permanent shareable review link (`?vv_review=`) + pause toggle |
| `billing-card` | `src/components/billing-card.tsx` | Account billing card → Stripe Customer Portal |
| `docs/*` | `src/components/docs/` | `docs-nav` (sidebar, active state), `docs-page-header`, `docs-page-footer` (next-page card) |
| `landing/*` | `src/components/landing/` | `bento-features`, `founder-note`, `product-demo`, `roi-calculator`, `pricing-cards`, `faq`, `how-it-works`, `site-header`, `site-footer` |

> Components are **kebab-case** filenames. A few legacy files remain PascalCase (`PostHogProvider.tsx`, `CookieConsent.tsx`, `GoogleSignInButton.tsx`, `CookiePreferencesLink.tsx`).

## Server Actions
| Action | Path | Purpose |
|---|---|---|
| `completeOnboardingAction` / `toggleOnboardingStepAction` | `src/actions/onboarding.ts` | Complete onboarding / toggle a checklist step |
| `createWorkspaceAction` / `leaveWorkspaceAction` | `src/actions/workspaces.ts` | Create workspace (resets member onboarding) / leave (notifies owner) |
| `updateFeedbackStatusAction` | `src/actions/feedback.ts` | Update feedback status |
| `toggleShareAction` | `src/actions/project-sharing.ts` | Enable/disable public board sharing (tier-gated) |
| `updateEmailPreferencesAction` | `src/actions/preferences.ts` | Update per-project email preferences |
| `getTierUsageAction` | `src/actions/tier.ts` | Tier, limits, and account-wide usage counts |
| `deleteProjectAction` | `src/actions/projects.ts` | Delete project with storage cleanup, notifications, digest queuing |
| `acceptInvite` | `src/actions/invites.ts` | Email-gated invite acceptance via admin client; rejects `role='client'`; fires `dispatchMemberWelcomeBootstrap` |
| `issueSelfWidgetLink` | `src/actions/widget-access.ts` | Mints a `widget_identities` row for an owner/member, returns `?vv_token=` activation URL |
| `requestWidgetAccessRecovery` | `src/actions/widget-access.ts` | Public, rate-limited action backing `/access`; anti-enumeration (always returns `ok=true`) |
| `setReviewFeedbackPaused` | `src/actions/review-link.ts` | Pause/resume review-link feedback (user-scoped update, RLS-enforced) |

## Database Tables (Current)
| Table | Key Columns |
|---|---|
| `profiles` | `id`, `email`, `has_onboarded`, `completed_onboarding_steps`, `stripe_*`, `trial_ends_at` |
| `workspaces` | `id`, `name`, `owner_id`, `logo_url` |
| `workspace_members` | `workspace_id`, `user_id`, `role` (owner/member — `client` blocked by CHECK). Composite PK, no `id` column |
| `workspace_invites` | `id`, `workspace_id`, `email`, `role` |
| `projects` | `id`, `name`, `api_key`, `workspace_id`, `website_url`, `share_token`, `is_sharing_enabled`, `review_token` (permanent, unique), `review_feedback_paused`, `widget_last_seen_at` (embed heartbeat, stamped by widget config GET; null ⇒ dashboard warns the review link is inert because the widget snippet was never seen loading) |
| `feedbacks` | `id`, `project_id`, `content`, `type`, `sender`, `status`, `metadata` |
| `feedback_replies` | `id`, `feedback_id`, `content`, `author_role`, `author_name` |
| `notifications` | `id`, `user_id`, `project_id`, `feedback_id`, `type`, `title`, `message`, `read` |
| `email_preferences` | `email`, `notify_replies`, `notify_new_feedback`, `notify_project_created`, `notify_project_deleted`, `email_frequency` |
| `email_digest_queue` | `id`, `recipient_email`, `notification_type`, `project_id`, `feedback_id`, `payload`, `sent_at`, `created_at` |
| `feedback_attachments` | `id`, `feedback_id`, `reply_id`, `project_id`, `file_name`, `file_url`, `file_size`, `mime_type`, `uploaded_by` |
| `widget_errors` | `id`, `api_key`, `error_message`, `error_stack`, `url`, `user_agent`, `metadata`, `created_at` |
| `widget_identities` | `id`, `project_id`, `invite_id` (nullable), `user_id` (nullable), `email`, `token_hash`, `via_review`, `display_name`, `created_at`, `last_used_at` — per-device widget auth tokens |

## API Routes
| Route | Method | Purpose |
|---|---|---|
| `/api/widget` | GET/POST | Widget config + feedback submission (Bearer token required) |
| `/api/widget/identity/exchange` | POST | Swap a `workspace_invites.id` (client bootstrap) for a per-device widget token. Guests never hit this route — see `/api/review/redeem` |
| `/api/review/redeem` | POST | Form target of the hosted `/review/[token]` gate: mints a guest `widget_identities` row and answers 303 to `${website_url}?vv_token=&vv_key=`, or 303 back to the gate with `?error=`. Public (excluded in proxy.ts) |
| `/api/widget/feedback` | GET | List feedback for widget (includes reply_count, plus `anchor` + `page_key` projected out of `metadata` for on-page pins) |
| `/api/widget/reply` | POST | Widget reply submission |
| `/api/widget/upload` | POST | Request presigned upload URLs for widget attachments |
| `/api/widget/upload/confirm` | POST | Confirm widget uploads + create DB records (verifies actual file size/type) |
| `/api/widget/stream` | GET | SSE real-time chat stream |
| `/api/dashboard/upload` | POST | Request presigned upload URLs for dashboard attachments |
| `/api/dashboard/upload/confirm` | POST | Confirm dashboard uploads + create DB records (verifies actual file size/type) |
| `/api/projects` | POST | Create project |
| `/api/workspaces/invites` | POST | Create workspace invite |
| `/api/stripe/checkout` | POST | Stripe checkout (redirects to portal if already subscribed) |
| `/api/stripe/portal` | POST | Stripe Customer Portal session for plan management |
| `/api/stripe/webhook` | POST | Stripe webhook (tier sync + downgrade enforcement) |
| `/api/auth/callback` | GET | Supabase auth callback |
| `/api/auth/turnstile` | POST | Turnstile verification |
| `/api/auth/delete-account` | POST | Delete account (cleans up email prefs, Stripe customer) |
| `/api/cron/digest` | GET | Processes queued digest emails (Supabase pg_cron, every 15 min) |
| `/api/widget/errors` | POST | Receives widget-side error reports, writes to `widget_errors` (rate-limited) |
| `/api/widget/capture-info` | POST | Receives screenshot-capture telemetry → PostHog `widget_screenshot_capture` event (browser, GPU, DPR, viewport, duration) |
| `/api/admin-alerts/auth-confirm-error` | POST | Beacon from `/auth/confirm` error branch → instant Resend email to `ADMIN_EMAIL`. Rate-limited per IP. Used to diagnose rare "Verification Failed" flashes we can't reproduce locally. |

## Proxy Redirects (`src/lib/supabase/proxy.ts`)
- Unauthenticated users on protected routes → `/auth/login`
- **Authenticated users** hitting `/auth/login` or `/auth/register` → `/dashboard` (skip duplicate sign-in screens)
- `/pricing` excluded from auth checks (public)
- `/compare` (and `/compare/*` SEO comparison pages) excluded from auth checks (public, must stay crawlable)
- `/docs/*` excluded from auth checks (public customer-facing documentation, must stay crawlable)
- `/api/admin-alerts/*` excluded from auth checks (beacons fire from pre-auth pages)
- `/unsubscribe` and `/api/unsubscribe` excluded from auth checks — **do not re-gate**: the opt-out link is in every notification email, and guests/invited clients have no account, so a login wall makes it impossible for them to unsubscribe (a compliance problem, not just UX). The `unsubscribe_token` is the credential. Pinned by `tests/unsubscribe-access.spec.ts`
- `/review/*` and `/api/review/*` excluded from auth checks (public guest entry point for shareable review links)
