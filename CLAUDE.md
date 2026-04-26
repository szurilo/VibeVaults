# VibeVaults — CLAUDE.md

## Project Overview
**VibeVaults** is a B2B SaaS feedback widget platform. Website owners embed `public/widget.js` to collect user feedback and engage clients in real-time chat. Multi-workspace, multi-project, role-based (owner/member/client).

## Tech Stack
- **Framework**: Next.js 16.1.4 (App Router, Turbopack) + React 19
- **Styling**: Tailwind CSS v4 + Shadcn/UI (Radix) + Framer Motion + Lucide
- **Backend/DB**: Supabase (PostgreSQL, Auth, Realtime) — Docker locally, Supabase Cloud in prod
- **Auth**: Magic Link (OTP) + Google OAuth + Cloudflare Turnstile for anti-bot
- **Emails**: Resend (transactional + notifications)
- **Payments**: Stripe — mandatory 14-day paid trial, NO free tier
- **Proxy**: `src/proxy.ts` (NOT `middleware.ts` — Next.js 16+ paradigm)
- **Analytics**: Vercel Analytics + Speed Insights + PostHog (EU region `eu.i.posthog.com`)
- **Error tracking**: PostHog — client (`PostHogProvider`, `capture_exceptions: true`), server (`instrumentation.ts` `onRequestError`), React boundary (`src/app/global-error.tsx`), widget (`public/widget.js` → `/api/widget/errors` → `widget_errors` table)
- **Tests**: Playwright E2E (`tests/`) — Tests across `access-matrix`, `account-deletion-safety`, `auth-roundtrip`, `dashboard`, `feedback-flow`, `member-departure`, `stripe-checkout`, `trial-expiration` with seed fixtures in `tests/fixtures/`. **Zero retries** on CI and local — a flaky test is treated as a real bug, not noise to paper over. Any describe block that mutates shared owner state (billing, workspace membership) must save it in `beforeAll` and restore it in `afterAll`; missing restoration pollutes every subsequent test file.

## Critical Rules
1. **Never mutate production DB** (Supabase Cloud / Stripe) without explicit permission. Migrations deploy via GitHub Actions.
2. **Never delete local Supabase data** without permission.
3. **Always write a short plan before coding**, ask clarifying questions when needed.
4. **No free tier** — always paid, 14-day trial only.
5. **No legacy data handling** needed — no paying users yet.
6. **Premium aesthetics required** — never "minimal viable". Polished, vibrant, well-lit UI.
7. **Shadcn cards** should look consistent. All dialogs use the same `AlertDialog` design.
8. **All emails** share the same styling template.
9. **Form validation** via standard React state — no form libraries.
10. **Add comment blocks** at top of complex files: "Main Responsibility" + "Sensitive Dependencies".
11. **Use Context7 MCP** proactively for library/API docs without user asking.
12. **Default terminal**: PowerShell (but Claude Code runs bash).
13. **Next.js 16**: `middleware.ts` → `src/proxy.ts`, Supabase middleware → `src/lib/supabase/proxy.ts`.

## File Structure
```
src/
  actions/          # Server Actions (feedback.ts, onboarding.ts, workspaces.ts, etc.)
  app/
    api/            # API routes (widget/, stripe/, auth/, workspaces/, projects/)
    auth/           # Auth pages (login, register, callback, confirm)
    dashboard/      # Dashboard pages (feedback, project-settings, settings, account, subscribe)
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
- `workspace_members` table: roles are `owner`, `member`, `client`
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

### RLS Security Pattern
- Use `SECURITY DEFINER` helper functions to avoid infinite recursion (42P17):
  - `get_user_workspaces()` — workspace IDs for current user
  - `get_user_owned_workspaces()` — owned workspace IDs
  - `get_client_project_ids()` — project IDs for invited clients

### Widget Flow
- `public/widget.js` → API routes at `/api/widget/*`
- **Widget visibility**: Widget always renders; if no stored email, shows an email prompt. Email is verified via `/api/widget/verify-email` before granting access. `vv_email` URL param still works for client invite links.
- **Authorization**: Sender is checked against `workspace_members` first (owners/members can use widget without invite), then falls back to `workspace_invites` (for clients). Self-invites are blocked.
- Feedback submission: `POST /api/widget`
- Real-time replies: SSE via `/api/widget/stream` + Supabase Realtime
- **Rate limiting**: 30 req/min per IP on all widget endpoints (`src/lib/widget-helpers.ts`)
- **Content limit**: 5000 chars max for feedback/reply content
- **Trial gate**: `validateApiKey()` checks owner's subscription/trial status — widget disabled post-trial
- **File uploads (presigned URL flow)**: Uploads bypass Vercel serverless functions entirely to avoid the 4.5MB body size limit on Hobby plan. Two-step flow: (1) `/api/widget/upload` or `/api/dashboard/upload` validates auth + returns presigned Supabase Storage URLs, (2) client uploads directly to Supabase Storage via PUT, (3) `/api/widget/upload/confirm` or `/api/dashboard/upload/confirm` verifies actual file size/type from storage metadata and creates `feedback_attachments` records. 10MB/file, 10 files/request.
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
- **Widget screenshot telemetry** (`/api/widget/screenshot-event`): every screenshot capture (success or failure) sends a beacon with browser, UA, GPU vendor/renderer (via `WEBGL_debug_renderer_info`), DPR, viewport, and duration. Forwarded to PostHog server-side as `widget_screenshot_capture` event. Purpose: size the impact of the known Firefox+GPU foreignObject rasterization bug (see below) so we can decide whether the canvas-substitute workaround is worth its quality tradeoff.
- **Known browser bug — Firefox foreignObject rasterization**: snapdom serializes the DOM into an SVG `<foreignObject>` and rasterizes it via `<img>`+canvas. On certain Firefox + GPU/driver combos with hardware acceleration enabled, Firefox's accelerated foreignObject paint **drops `background-color` fills on small pill-shaped elements** (`rounded-full` with non-transparent bg + box-shadow), leaving a ghost silhouette where the box-shadow rendered but the fill and inner text didn't. Confirmed via raw-SVG diagnostic that snapdom serializes correct markup; the bug is purely in Firefox's GPU rasterization step. **End-user workaround**: disable Firefox HW acceleration (`about:preferences` → Performance → uncheck "Use hardware acceleration"). **Code workaround**: not currently shipped — a canvas-substitute pre-pass would degrade screenshot fidelity for 100% of users to fix it for an unknown small minority. Decision deferred until telemetry sizes the problem. Affects all foreignObject-based libraries (`html-to-image`, `dom-to-image`, `modern-screenshot`); only `html2canvas`-family libraries sidestep it but at significant fidelity cost on modern CSS.
- **Admin signup alerts**: DB trigger `notify_admin_on_new_signup` fires via pg_net to `/api/notifications/new-signup` (secret-guarded via `SIGNUP_NOTIFY_SECRET`), which emails `ADMIN_EMAIL` via Resend.

### Notification System
- DB triggers: `notify_new_feedback`, `notify_new_reply`, `notify_project_created`, `notify_project_deleted`, `notify_admin_on_new_signup`
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

## Database Tables (Current)
| Table | Key Columns |
|---|---|
| `profiles` | `id`, `email`, `has_onboarded`, `completed_onboarding_steps`, `stripe_*`, `trial_ends_at` |
| `workspaces` | `id`, `name`, `owner_id`, `logo_url` |
| `workspace_members` | `workspace_id`, `user_id`, `role` (owner/member/client) |
| `workspace_invites` | `id`, `workspace_id`, `email`, `role` |
| `projects` | `id`, `name`, `api_key`, `workspace_id`, `website_url`, `share_token`, `is_sharing_enabled` |
| `feedbacks` | `id`, `project_id`, `content`, `type`, `sender`, `status`, `metadata` |
| `feedback_replies` | `id`, `feedback_id`, `content`, `author_role`, `author_name` |
| `notifications` | `id`, `user_id`, `project_id`, `feedback_id`, `type`, `title`, `message`, `read` |
| `email_preferences` | `email`, `notify_replies`, `notify_new_feedback`, `notify_project_created`, `notify_project_deleted`, `email_frequency` |
| `email_digest_queue` | `id`, `recipient_email`, `notification_type`, `project_id`, `feedback_id`, `payload`, `sent_at`, `created_at` |
| `feedback_attachments` | `id`, `feedback_id`, `reply_id`, `project_id`, `file_name`, `file_url`, `file_size`, `mime_type`, `uploaded_by` |
| `widget_errors` | `id`, `api_key`, `error_message`, `error_stack`, `url`, `user_agent`, `metadata`, `created_at` |

## API Routes
| Route | Method | Purpose |
|---|---|---|
| `/api/widget` | GET/POST | Widget config + feedback submission |
| `/api/widget/verify-email` | GET | Lightweight email authorization check for widget |
| `/api/widget/feedbacks` | GET | List feedbacks for widget (includes reply_count) |
| `/api/widget/reply` | POST | Widget reply submission |
| `/api/widget/upload` | POST | Request presigned upload URLs for widget attachments |
| `/api/widget/upload/confirm` | POST | Confirm widget uploads + create DB records (verifies actual file size/type) |
| `/api/widget/stream` | GET | SSE real-time chat stream |
| `/api/dashboard/upload` | POST | Request presigned upload URLs for dashboard attachments |
| `/api/dashboard/upload/confirm` | POST | Confirm dashboard uploads + create DB records (verifies actual file size/type) |
| `/api/projects` | POST | Create project |
| `/api/workspaces/invites` | POST | Create workspace invite |
| `/api/stripe/checkout` | POST | Stripe checkout |
| `/api/stripe/webhook` | POST | Stripe webhook |
| `/api/auth/callback` | GET | Supabase auth callback |
| `/api/auth/turnstile` | POST | Turnstile verification |
| `/api/cron/digest` | GET | Processes queued digest emails (Supabase pg_cron, every 15 min) |
| `/api/widget/errors` | POST | Receives widget-side error reports, writes to `widget_errors` (rate-limited) |
| `/api/widget/screenshot-event` | POST | Receives screenshot-capture telemetry beacons → PostHog `widget_screenshot_capture` event (browser, GPU, DPR, viewport, duration) |
| `/api/notifications/new-signup` | POST | Admin signup alert (secret-guarded, called by DB trigger via pg_net) |

## Proxy Redirects (`src/lib/supabase/proxy.ts`)
- Unauthenticated users on protected routes → `/auth/login`
- **Authenticated users** hitting `/auth/login` or `/auth/register` → `/dashboard` (skip duplicate sign-in screens)
- `/pricing` excluded from auth checks (public)
