# VibeVaults - Project Summary

## 1. Project Overview & State
**VibeVaults** is a B2B SaaS application providing an embeddable feedback widget (`public/widget.js`) for clients to seamlessly collect user feedback and engage in real-time chat directly from their websites. It supports multi-workspace, multi-project architecture with role-based access (owners, team members, clients).
**Current State**: In active development (mostly functional) — currently focused on notification refinements, widget UX polish, member/client management improvements, feedback filtering, and continuous UI/UX dashboard refinement.

## 2. Architecture & Tech Stack
- **Frontend**: Next.js 16.1.4 (App Router, Turbopack) combined with React 19.
- **Styling & UI Components**: Tailwind CSS v4, Shadcn/UI (Radix components), Framer Motion for animations, and Lucide React for icons.
- **Backend/Database**: Supabase (PostgreSQL, Auth, Realtime) — local Docker instance for development, Supabase cloud for production.
- **Widget Flow**: A lightweight Vanilla JS script (`public/widget.js`) embedded on client sites, interacting with Next.js API routes (`/api/widget/*`) and SSE streams.
- **Communications**: Server-Sent Events (SSE) via `/api/widget/stream` and Supabase Realtime power the live chat, broadcasting instant replies to dashboard views and widget instances.
- **Authentication**: Supabase Magic Link (OTP) + Google OAuth (both passwordless). Turnstile for anti-bot on public forms.
- **Transactions & Emails**: Resend powers transactional emails (signup, invites, notifications). Stripe enforces a mandatory 14-day paid trial pipeline.
- **Proxy (Middleware)**: `src/lib/supabase/proxy.ts` replaces the traditional `middleware.ts` per Next.js 16+ paradigm. Handles auth session refresh and protected route enforcement.
- **Analytics**: Vercel Analytics + Speed Insights integrated.
- **CI/CD**: GitHub Actions workflows for DB migration deployment (`deploy-migrations.yml`), Supabase backups (`supabase-backup.yml`), and Playwright E2E tests (`playwright.yml`).

## 3. Strict Guidelines & AI Constraints
- **Next.js 16 Paradigm**: The traditional `middleware.ts` is explicitly replaced by `src/proxy.ts`. Same architectural shift applies to Supabase middleware integrations.
- **Database Safety**: Under NO circumstances should the production DB (Supabase cloud) be mutated, updated, or manipulated without explicit permission. Changes to production DB schema are managed via migration files and deployed by GitHub Actions. Local dev data running on Docker Desktop also requires permission before destructive actions.
- **Monetization Constraint**: VibeVaults is exclusively a paid platform with a 14-day trial. No free tier. Be aware of this when changing auth/onboarding flows.
- **No Legacy Data Handling**: There are no paying users in the live database yet, so no need for backfilling, fallback handling, or legacy data migration.
- **Aesthetics Required**: Emphasize dynamic and polished designs. Never construct "minimal viable" aesthetics, generic buttons, or standard themes. Build premium, vibrant, well-lit components with robust visual hierarchy.
- **Information Retrieval**: Always proactively leverage Context7 MCP to double-check API documentation, setup flows, or code configurations — no user prompting needed.
- **File Documentation**: For complex files (e.g., `feedback-card.tsx`, `layout.tsx`), maintain a brief comment block at the top explaining their "Main Responsibility" and "Sensitive Dependencies".
- **Consistent UI**: Shadcn cards should look the same unless told otherwise. All dialogs use the same AlertDialog design. All emails share consistent styling.
- **Form Validation**: Use standard React state for form validations (no form libraries).

## 4. Current Direction & Recent Epics

### Workspace Architecture (Multi-Owned, Multi-Joined)
- Evolved the Workspace and Project hierarchy to allow users to create and own multiple workspaces securely (via RPC `create_workspace`), as well as delete their own workspaces. They can also join unlimited additional workspaces via invitation. Cookie-based state persistence (`selectedWorkspaceId`, `selectedProjectId`) navigates these environments across the dashboard.
- **Trial start moved to first-owned-workspace creation** (not signup). `handle_new_user` no longer sets `trial_ends_at`; both `handle_new_workspace_for_user` (auto-create path) and the `create_workspace` RPC set `trial_ends_at = now() + 14 days WHERE trial_ends_at IS NULL`. Invited members who never own a workspace don't burn their trial clock. The `AppSidebar` tier badge and `isTrialExpired` lock are gated on `ownsAnyWorkspace` so members aren't shown a misleading "Trial (Pro)" badge or locked out.

### Team Member & Client Invites
- Comprehensive invitation system supporting both `member` and `client` roles. Team members get access to all projects in a workspace. Clients can review specific projects.
- **Client invites are now workspace-level** (moved from project-level), simplifying the invite flow.
- Auto-acceptance of pending invites happens in `dashboard/layout.tsx` on login. RLS policies use `SECURITY DEFINER` helper functions (like `get_client_project_ids()`) to securely allow invited clients to view and interact with feedbacks.
- **Deferred account creation (GDPR)**: invite emails now link to `/auth/accept-invite?token=<invite_id>` instead of a pre-provisioned magic link. No `auth.users` row is created until the invitee actively signs in (magic link or Google OAuth). Accept-invite page handles four states — auto-accept, guest sign-in surface, email-mismatch (with sign-out recovery), and invalid-invite. `acceptInvite()` server action (`src/actions/invites.ts`) gates membership on email match via admin client; duplicate-insert (`23505`) is treated as success. After auto-accept, `dashboard/layout.tsx` re-reads workspaces via the admin client to bypass Next.js Request Memoization (user-scoped query would return a pre-insert snapshot).

### Member Access Revocation & Notifications
- Full notification flow when a member is removed or leaves a workspace:
  - **Owner revokes member**: member receives in-app bell notification + email notification + toast.
  - **Member leaves workspace**: owner receives in-app bell notification + email notification.
- New notification types: `member_revoked`, `member_left`.
- Workspace switcher hidden when member has no workspaces (after revocation).
- `notifications.project_id` made nullable to support workspace-level notifications not tied to specific projects.

### Account Cleanup
- Deleting an account now also deletes the user's `email_preferences` record (keyed by email, not user_id) to prevent orphaned data.

### RLS & Database Security
- Resolved infinite recursion (`42P17`) bugs in Supabase Row Level Security by refactoring policies to use `SECURITY DEFINER` helper functions (`get_user_workspaces()`). This securely resolves client/agency authorizations without circular foreign key table locks.

### Onboarding
- Role-specific checklist system in `Onboarding.tsx`:
  - **Owners** see 8 steps: Create project (opens `CreateProjectDialog`), Embed widget, Invite members, Invite clients, Create feedback, Customize workspace, Customize project, Share board. Three steps marked as ⭐ Recommended.
  - **Members** see 1 step: Create Feedback as a Team member.
  - Checklist auto-completes (`has_onboarded = true`) only when all items are checked.
  - Dismissible into a persistent **mini-banner** (`localStorage`-backed collapsed state) with a Resume button.
  - "Go" links navigate to anchor-highlighted target cards.
  - `completed_onboarding_steps` text array column in `profiles` table.
  - Members who create their first workspace get onboarding reset to show the owner checklist.
  - **Auto-check feature removed** — onboarding steps are manually tracked only.
- Workspaces are auto-created for new owners on signup — no manual "Create Workspace" step in onboarding.
- Shared `CreateProjectDialog` component used by both `ProjectSwitcher` and `Onboarding`.

### Widget Enhancements
- **Email verification prompt**: Widget always renders; if no stored email, shows an email prompt. Verified via `/api/widget/verify-email` before granting access. `vv_email` URL param still works for client invite links.
- **Screenshot functionality in replies**: Widget replies now support screenshots and file attachments.
- **Attachment support in replies**: Reply endpoint returns `replyId` for subsequent attachment uploads; allows empty text if attachments present.
- **Completed feedbacks hidden from widget**: Only shows `open`, `in progress`, `in review` statuses.
- **UI/layout refinements**: `.compact` and `.tall` height variants, improved scrolling, better spacing, reply attachment preview padding.
- **Authorization**: Two-tier check — workspace members (owner/member) auto-allowed via profile lookup, falls back to `workspace_invites` for clients. Self-invites blocked.
- **Rate limiting**: 30 req/min per IP on all widget endpoints (`src/lib/widget-helpers.ts`). Auto-cleans expired entries every 5 minutes.
- **Content limits**: 5000 chars max for feedback/reply content.
- **Trial gate**: `validateApiKey()` checks owner's subscription/trial status — widget returns 403 post-trial.
- **HTML injection prevention**: All user content in emails sanitized via `esc()` in `lib/notifications.ts`.

### Feedback Status Filtering (Dashboard)
- New `FeedbackList` component with dropdown status filter (Open, In Progress, In Review, Completed).
- Default hides Completed status; users can toggle filter.
- Shows badge count when filtered.

### Feedback Card Highlighting
- New `Highlight` component replaces `AnchorHighlight` — wraps content with ID and applies pulsating highlight animation with dark overlay.
- URL hash-based navigation: clicking notification with feedback ID auto-scrolls and highlights card.
- Dismissible overlay.

### Notification System
- DB triggers: `notify_new_feedback`, `notify_new_reply`, `notify_project_created`, `notify_project_deleted`.
- Simplified trigger messages: title = "New feedback/reply received from {sender_name}", message = content preview.
- **All workspace members now notified on all replies** (was previously client-only).
- **Project deletion notifications**: Bell notification includes deleter's name (derived from email, falls back to "A team member"). Excludes the user who deleted.
- In-app: `GlobalNotificationProvider` + `NotificationBell` via Supabase Realtime.
- NotificationBell enhancements: `clearAll()` method, notification type icons (`MessageSquare`, `PlusCircle`, `UserMinus`, `LogOut`, `Trash2`), workspace-level notification routing.
- Email: Resend via `lib/notifications.ts` with per-user preferences. New email functions: `sendMemberRemovedNotification()`, `sendMemberLeftNotification()`, `sendProjectEventDigestEmail()`.
- Toast: Unified via `GlobalNotificationProvider`.

### Email Digest & Cooldown System
- **Goal**: Reduce Resend email volume by batching notifications instead of sending per-event.
- **Digest logic** (`src/lib/email-digest.ts`):
  - **Feedback emails**: 15-min digest window (`FEEDBACK_DIGEST_WINDOW_MS`) per recipient per project. First email sent immediately, subsequent queued.
  - **Reply emails**: 10-min cooldown (`REPLY_COOLDOWN_MS`) per recipient per feedback thread. First email sent immediately, subsequent queued.
- **Queue table**: `email_digest_queue` — stores pending (unsent) and sent (with `sent_at`) email records for cooldown checks.
- **Cron scheduling**: Supabase `pg_cron` + `pg_net` every 15 min (migration `20260320000000_pg_cron_email_digest.sql`). Calls `GET https://vibe-vaults.com/api/cron/digest`. No auth needed (endpoint is idempotent). No Vercel cron dependency.
- **Digest email templates**: `sendFeedbackDigestEmail()`, `sendReplyDigestEmail()`, and `sendProjectEventDigestEmail()` in `notifications.ts`.
- **Email frequency preference**: `email_preferences.email_frequency` column — `'digest'` (default) or `'realtime'` (reserved for future paid tier).
- **Localhost safety**: All email preferences default to off when `NODE_ENV !== 'production'` — no dev email noise.
- **Self-notification prevention**: Reply emails are never sent to the person who wrote the reply (in both `sendAgencyReplyAction` and widget reply route).
- **Reply email wording**: Uses sender's email in template (not hardcoded "Support") — "New reply received!", "{sender} has responded...", "Says:".

### Public Sharing
- Read-only project board sharing via tokenised links (`/share/[token]`). Managed in `ShareProjectCard` with server actions in `actions/project-sharing.ts`.

### File Attachments (Presigned URL Flow)
- Full attachment support for feedbacks and replies. `feedback_attachments` table stores file metadata (name, URL, size, MIME type, uploader). Files stored in Supabase Storage (`feedback-attachments` bucket).
- **Presigned URL upload flow** (bypasses Vercel's 4.5MB serverless body size limit on Hobby plan):
  1. Client sends file metadata (names, sizes, MIME types) to `/api/widget/upload` or `/api/dashboard/upload` — tiny JSON payload.
  2. API validates (auth, API key, tier/storage limits, file types/sizes) and returns presigned Supabase Storage URLs via `createSignedUploadUrl()`.
  3. Client uploads each file directly to Supabase Storage via PUT to the signed URL — Vercel is never in the file transfer path.
  4. Client calls `/api/widget/upload/confirm` or `/api/dashboard/upload/confirm` — API verifies actual file size/type from storage metadata, deletes violating files, and creates `feedback_attachments` records.
- **Client-side validation**: Both widget and dashboard enforce max 10 files and 10MB/file before sending. Widget shows toast; dashboard shows inline error or toast.
- Widget and dashboard both support file upload with preview. Feedback card shows image thumbnails with lightbox viewer and non-image files as download links.
- Real-time attachment updates via Supabase Realtime.
- Constraints: 10MB max per file, 10 files per request, MIME type allowlist (images, PDFs, Office docs, text/csv). Server-side enforcement in confirm routes reads actual storage metadata (not client-claimed values).
- Reply attachments supported end-to-end (widget screenshot, file upload → API → storage → display).

### Access & Role Helpers (centralised gates)
- **Subscription/trial predicate** centralised in `src/lib/tier-config.ts` as `hasActiveAccess(profile)` (plus `isSubscribed`, `isTrialActive`, `isTrialExpired`). Re-exported from `tier-helpers.ts` for ergonomics. Predicates live in `tier-config.ts` because it has no server-only imports — safe for both client and server components. Replaces three duplicated implementations in `widget-helpers.ts` (widget gate), `supabase/proxy.ts` (paywall), and `tier-helpers.ts` (tier resolution), and three `isTrialExpired` inline derivations in `app-sidebar.tsx`, `dashboard/layout.tsx`, `subscribe/page.tsx`.
- **Workspace role helpers** in `src/lib/role-helpers.ts`: `isWorkspaceOwner(supabase, userId, workspaceId)` for async DB lookups (API routes, server actions) and pure derivations `isOwnerInMembers(members, userId)` / `getRoleFromMembers(members, userId)` for already-fetched members lists (server components). Replaces scattered `membership.role !== 'owner'` checks in `api/workspaces/invites/route.ts` (x2) and `.some(m => m.role === 'owner')` in `settings/page.tsx` and `settings/users/page.tsx`.
- Rationale: role and billing gates are the highest-risk cross-cutting concerns in the app. Centralising them removes drift between sites and makes the widget gate / paywall / UI all respond to a single logic change. New code must route through these helpers — no more inline role/subscription checks.

### Multi-Tier Pricing
- Three tiers: Starter ($29/mo), Pro ($49/mo), Business ($149/mo) with yearly billing (20% off).
- Tier config single source of truth: `src/lib/tier-config.ts` (limits, prices, Stripe price/product IDs from env vars).
- Tier enforcement helpers: `src/lib/tier-helpers.ts` — `getUserTier()`, `getWorkspaceOwnerTier()`, `checkWorkspaceLimit()`, `checkProjectLimit()`, `checkMemberLimit()`, `checkStorageLimit()`.
- **Limits are account-wide** (not per-workspace): project count sums across all owned workspaces.
- Error messages are context-aware: owners see "Upgrade to add more", members see "Ask the owner to upgrade".
- Stripe Customer Portal for plan management (upgrade/downgrade/cancel) via `/api/stripe/portal`.
- Stripe subscription schedules supported for end-of-period downgrades.
- Checkout prevents duplicate subscriptions — redirects to Customer Portal if user already has active subscription.
- Webhook auto-enforces tier limits on downgrade: disables public sharing, reverts email frequency to digest.
- Widget branding gated by tier (`showBranding` flag from `validateApiKey()`).
- Share board gated by tier in both `toggleProjectSharing()` action and `/share/[token]` page.
- `BillingCard` on account page with "Manage Billing" button (Stripe Customer Portal).
- `profiles.subscription_tier` column: `'starter' | 'pro' | 'business'` (null = trial/no subscription).

### Subscribe Page
- `/dashboard/subscribe` is a server component with context-aware messaging:
  - Trial expired: "Your trial has expired".
  - Trial active: "Choose your plan" with days remaining.
  - Subscribed: "Upgrade your plan" (for changing tiers).
- Uses shared `PricingCards` component with monthly/yearly toggle.
- Pro tier pre-selected. Price IDs passed from server side (not client env vars).

### Pricing Page
- Public `/pricing` page with `PricingCards` component and feature comparison table.
- Added to proxy exclusion list for unauthenticated access.

### Project Deletion
- Members (not just owners) can now delete projects in their workspace (RLS policy updated).
- Deletion cleans up storage files via `cleanupProjectStorage()` in `src/actions/projects.ts`.
- Bell notification sent to all workspace members (excluding deleter) with deleter's name attribution.
- Email notification (immediate or queued to digest) with `notify_project_deleted` pref support.
- `email_digest_queue.project_id` made nullable to support deleted project references (FK constraint removed).

### Screenshot & Image Viewer
- Replaced `html-to-image` with `snapDOM` for Safari compatibility.
- Image viewers (feedback card lightbox) now have a maximize/fullscreen option.

### Unsaved Changes Warnings
- `WorkspaceSettingsCard` and `EditProjectCard` warn users before navigating away with unsaved changes via `beforeunload` event.

### Widget Robustness
- DOM-ready guard added to `widget.js` so it loads regardless of script placement.
- Widget stops working after access revocation (no stale sessions).

### Landing Page Redesign
- New landing components: `BentoFeatures` (feature showcase grid), `FounderNote` (social proof/early-access), `ProductDemo` (hero with video embed), `ROICalculator` (interactive cost savings calculator).
- Removed `UserFlowAnimation` component.
- Branding removed from public share board.

### Email Templates
- Consistent styling across all transactional emails with "If you have questions, reach out to support@vibe-vaults.com" footer.
- Branding with `public/avatar.jpg`.
- HTML escaping via `esc()` throughout.
- Welcome email finalized, with `scripts/send-welcome.ts` for manual sending.

### E2E Testing
- Playwright-based end-to-end test infrastructure with GitHub Actions CI integration. Expanded to **Tests** across `tests/access-matrix.spec.ts`, `tests/account-deletion-safety.spec.ts`, `tests/auth-roundtrip.spec.ts`, `tests/dashboard.spec.ts`, `tests/feedback-flow.spec.ts`, `tests/member-departure.spec.ts`, `tests/stripe-checkout.spec.ts`, `tests/trial-expiration.spec.ts`.
- Fixtures in `tests/fixtures/`: `seed.ts` (programmatic test-data seeding), `stripe-mock.ts` (Stripe webhook simulation), `test-data.ts`, `tests/utils/supabase-admin.ts`.
- `global-setup.ts` + `global-teardown.ts` handle test-data lifecycle — data is torn down after each run to keep the local DB clean. `global-setup.ts` also writes a `.playwright-running` flag file that `src/lib/resend.ts` checks to short-circuit email sends during E2E runs (no dev inbox noise, no Resend quota burn).
- **Zero retries policy** (`retries: 0` in `playwright.config.ts` for both CI and local). Retries on CI were previously masking real state-pollution bugs by marking them "flaky" instead of failing — a describe block that forgot its `afterAll` reset would pass CI because the following spec's `afterAll` happened to clean up during the retry's `beforeAll` rerun. Moving to zero retries forces every infra/timing flake or cross-spec pollution bug to surface as a red build immediately.
- **State-mutation rule for describe blocks**: any `beforeAll` that mutates shared owner state (billing tier, workspace membership, trial dates) MUST pair with an `afterAll` that restores the captured original — not a hardcoded default. Three blocks in `access-matrix.spec.ts` follow this pattern (Widget gate, Dashboard paywall, Invite endpoint × role). The Invite endpoint block was originally missing this restoration, leaving the owner in `subscribed-pro` state for every subsequent spec and causing `stripe-checkout.spec.ts`'s "clicking Subscribe" test to find "Upgrade" buttons instead of "Subscribe".

### Observability (PostHog)
- **PostHog** (EU region `eu.i.posthog.com`) for product analytics and error tracking. Client exceptions auto-captured via `PostHogProvider` with `capture_exceptions: true`. Server errors captured by `instrumentation.ts` `onRequestError` using `posthog-node` (Next.js 15+ built-in mechanism). React render errors caught by `src/app/global-error.tsx`.
- **Widget error reporter** in `public/widget.js`: hooks `window.error` (filtered to `widget.js` frames) and `unhandledrejection`, POSTs to `/api/widget/errors` via `navigator.sendBeacon` (fetch fallback). Per-session deduplication prevents one bug from flooding the table. Records stored in `widget_errors` table (migration `20260402100000_widget_errors_table.sql`).
- **Admin signup alerts**: DB trigger `notify_admin_on_new_signup` → pg_net → `/api/notifications/new-signup` (secret-guarded via `SIGNUP_NOTIFY_SECRET` query param) → Resend email to `ADMIN_EMAIL`. Implemented in migration `20260401100000_notify_admin_on_new_signup.sql`.

### Deleted-Feedback & Notification Navigation
- Clicking a notification for a deleted feedback no longer 404s. `src/components/feedback-deleted-toast.tsx` renders a toast instead, driven from the feedback detail page.
- `src/lib/notification-navigation.ts` is the shared navigation helper used by both the bell dropdown and toast-click. It looks up the target project's `workspace_id`, writes both `selectedWorkspaceId` and `selectedProjectId` cookies, then routes — so the sidebar context follows the notification rather than staying on the previously selected workspace.

### Account Deletion Cleanup (Client-Side)
- On successful account deletion, `delete-account-card.tsx` clears localStorage and all cookies before redirect — prevents stale session data from bleeding into a subsequent signup on the same browser.

### Proxy Redirects
- `src/lib/supabase/proxy.ts` now redirects already-authenticated users away from `/auth/login` and `/auth/register` to `/dashboard` (skip duplicate sign-in screens).
- `/pricing` added to the proxy's public-routes exclusion list.

### Auth Cookie Size Fix (tokens-only encoding)
- Google OAuth metadata bloats session cookies to ~5KB+, exceeding Kong's WebSocket upgrade header buffer and causing HTTP 431 errors that silently kill Supabase Realtime (in-app notifications stop while server-side emails keep working).
- Fix: `cookies.encode: 'tokens-only'` on all three Supabase client factories (`client.ts`, `server.ts`, `proxy.ts`). Drops cookie from ~5.2KB to ~800B by storing only access + refresh tokens.
- `@supabase/ssr` pinned to exact `0.8.0` (the `encode` option is `@experimental`). `cookie` package promoted to direct dep for browser client's `getAll`/`setAll` handlers.
- Browser client provides explicit `auth.userStorage` with SSR-safe fallback (library bug: tries `window.localStorage` during SSR pre-rendering when `tokens-only` is set).
- **IMPORTANT**: `getSession().user` is empty with this encoding. Always use `getUser()` or `getClaims()`.

### Landing Page
- Refining the landing page (`src/app/page.tsx`) to effectively promote product selling points and encourage sign-ups.

## 5. Key Components Reference
| Component | Path | Purpose |
|---|---|---|
| `Onboarding` | `src/components/Onboarding.tsx` | Role-specific onboarding checklist with collapse/expand |
| `CreateProjectDialog` | `src/components/CreateProjectDialog.tsx` | Shared project creation dialog (sidebar & onboarding) |
| `Highlight` | `src/components/Highlight.tsx` | Wraps cards with ID, pulsating highlight on hash navigation |
| `FeedbackList` | `src/components/FeedbackList.tsx` | Feedback grid with status filter dropdown |
| `ProjectSwitcher` | `src/components/ProjectSwitcher.tsx` | Sidebar project dropdown with create option |
| `WorkspaceSwitcher` | `src/components/WorkspaceSwitcher.tsx` | Sidebar workspace dropdown with create option |
| `AppSidebar` | `src/components/AppSidebar.tsx` | Main dashboard sidebar layout |
| `UserManagement` | `src/components/UserManagement.tsx` | Users page: member list, invite form, leave/revoke |
| `feedback-card` | `src/components/feedback-card.tsx` | Feedback detail card with real-time chat, status, replies, attachments |
| `GlobalNotificationProvider` | `src/components/GlobalNotificationProvider.tsx` | Real-time notification context + unified toast via Supabase Realtime |
| `NotificationBell` | `src/components/NotificationBell.tsx` | Header notification dropdown with live updates, type icons, clearAll |
| `EmbedWidgetCard` | `src/components/EmbedWidgetCard.tsx` | Widget embed code snippet card |
| `ShareProjectCard` | `src/components/ShareProjectCard.tsx` | Public board sharing with token management |
| `WorkspaceSettingsCard` | `src/components/WorkspaceSettingsCard.tsx` | Workspace branding & settings |
| `EditProjectCard` | `src/components/EditProjectCard.tsx` | Project name/URL editing |
| `AddFeedbackDialog` | `src/components/AddFeedbackDialog.tsx` | Manual feedback creation dialog |
| `PricingCards` | `src/components/landing/PricingCards.tsx` | Shared pricing cards with monthly/yearly toggle (landing, /pricing, subscribe) |
| `BentoFeatures` | `src/components/landing/BentoFeatures.tsx` | Feature showcase grid with icons and screenshots |
| `FounderNote` | `src/components/landing/FounderNote.tsx` | Founder social proof section with early-access framing |
| `ProductDemo` | `src/components/landing/ProductDemo.tsx` | Hero section with video embed and screenshots |
| `ROICalculator` | `src/components/landing/ROICalculator.tsx` | Interactive calculator showing time/cost savings |
| `BillingCard` | `src/components/BillingCard.tsx` | Account page billing card with Stripe Customer Portal link |
| `DeleteAccountCard` | `src/components/DeleteAccountCard.tsx` | Account page danger zone for account deletion |
| `NotificationsCard` | `src/components/NotificationsCard.tsx` | Account page email notification preferences |

## 6. API Routes
| Route | Method | Purpose |
|---|---|---|
| `/api/widget` | GET/POST | Widget config + feedback submission |
| `/api/widget/verify-email` | GET | Lightweight email authorization check for widget |
| `/api/widget/feedbacks` | GET | List feedbacks for widget (includes reply_count, attachments, excludes completed) |
| `/api/widget/reply` | POST | Submit reply from widget chat (supports attachments, returns replyId) |
| `/api/widget/upload` | POST | Request presigned upload URLs for widget attachments |
| `/api/widget/upload/confirm` | POST | Confirm widget uploads + create DB records (verifies actual file size/type) |
| `/api/widget/stream` | GET | SSE stream for real-time chat |
| `/api/dashboard/upload` | POST | Request presigned upload URLs for dashboard attachments |
| `/api/dashboard/upload/confirm` | POST | Confirm dashboard uploads + create DB records (verifies actual file size/type) |
| `/api/projects` | POST | Create new project |
| `/api/workspaces/invites` | POST | Create workspace invite (member or client role) |
| `/api/auth/callback` | GET | Supabase auth callback handler |
| `/api/auth/turnstile` | POST | Turnstile token verification |
| `/api/auth/delete-account` | POST | Delete user account (cleans up email prefs, Stripe customer) |
| `/api/stripe/checkout` | POST | Stripe checkout session (redirects to portal if already subscribed) |
| `/api/stripe/portal` | POST | Stripe Customer Portal session for plan management |
| `/api/stripe/webhook` | POST | Stripe webhook handler (tier sync + downgrade enforcement) |
| `/api/cron/digest` | GET | Processes queued digest emails (Supabase pg_cron, every 15 min) |
| `/api/widget/errors` | POST | Receives widget-side error reports (rate-limited, sendBeacon) → `widget_errors` table |
| `/api/notifications/new-signup` | POST | Admin signup alert endpoint (secret-guarded, invoked by DB trigger via pg_net) |

## 7. Server Actions
| Action | Path | Purpose |
|---|---|---|
| `completeOnboardingAction` | `src/actions/onboarding.ts` | Mark onboarding as complete |
| `toggleOnboardingStepAction` | `src/actions/onboarding.ts` | Toggle individual checklist steps |
| `createWorkspaceAction` | `src/actions/workspaces.ts` | Create workspace (resets onboarding for members) |
| `leaveWorkspaceAction` | `src/actions/workspaces.ts` | Leave workspace (notifies owner via bell + email) |
| `updateFeedbackStatusAction` | `src/actions/feedback.ts` | Update feedback status |
| `toggleShareAction` | `src/actions/project-sharing.ts` | Enable/disable public board sharing |
| `updateEmailPreferencesAction` | `src/actions/preferences.ts` | Update per-project email preferences |
| `getTierUsageAction` | `src/actions/tier.ts` | Returns tier, limits, and account-wide usage counts |
| `deleteProjectAction` | `src/actions/projects.ts` | Delete project with storage cleanup, notifications, and digest queuing |
| `acceptInvite` | `src/actions/invites.ts` | Email-gated invite acceptance — creates `workspace_members` row via admin client after validating authed user's email matches invite target |

## 8. Database Schema (Key Tables)
| Table | Purpose |
|---|---|
| `profiles` | User profiles, onboarding state (`has_onboarded`, `completed_onboarding_steps`), Stripe fields (`stripe_customer_id`, `stripe_subscription_id`, `subscription_status`, `subscription_tier`), `trial_ends_at` |
| `workspaces` | Multi-tenant workspaces with branding (name, logo) |
| `workspace_members` | User ↔ workspace association with role (`owner`, `member`, `client`). Composite key `(workspace_id, user_id)` — no `id` column |
| `workspace_invites` | Pending invitations with email, role, workspace reference |
| `projects` | Projects within workspaces (name, `website_url`, `api_key`, `share_token`, `is_sharing_enabled`) |
| `feedbacks` | User-submitted feedback entries with status, metadata, screenshots |
| `feedback_replies` | Threaded replies on feedback items (real-time enabled) |
| `feedback_attachments` | File attachments for feedbacks/replies (name, URL, size, MIME type, uploader) |
| `widget_errors` | Widget-side error reports (api_key, message, stack, url, user_agent, metadata, created_at) |
| `notifications` | In-app notification records. `project_id` is nullable for workspace-level notifications |
| `email_preferences` | Per-user email notification preferences (keyed by email). Includes `email_frequency` (`digest`/`realtime`) |
| `email_digest_queue` | Queued/sent email records for digest batching and cooldown checks |


## 9. Recent Database Migrations
| Migration | Purpose |
|---|---|
| `20260315000000_simplify_notification_messages.sql` | Simplified trigger messages, all workspace members notified on replies |
| `20260318000000_nullable_notification_project_id.sql` | Made `notifications.project_id` nullable for workspace-level notifications |
| `20260319000000_add_email_digest.sql` | Added `email_digest_queue` table + `email_frequency` column on `email_preferences` |
| `20260320000000_pg_cron_email_digest.sql` | pg_cron + pg_net setup, `app_config` table, scheduled digest processing every 15 min |
| `20260325000000_add_subscription_tier.sql` | Added `subscription_tier` column to `profiles` (starter/pro/business) |
| `20260328000000_allow_members_delete_projects.sql` | Allow workspace members (not just owners) to delete projects |
| `20260328100000_notify_project_deleted.sql` | DB trigger `notify_project_deleted` — bell notification to workspace members on project deletion |
| `20260328200000_add_notify_project_deleted_pref.sql` | Added `notify_project_deleted` column to `email_preferences` |
| `20260328300000_enable_rls_email_digest_queue.sql` | Enabled RLS on `email_digest_queue` (server-only access) |
| `20260329000000_project_deleted_include_deleter_name.sql` | Enhanced deletion notification with deleter's name attribution |
| `20260329100000_digest_queue_allow_project_deleted.sql` | Added `project_deleted` type to digest queue, made `project_id` nullable |
| `20260401100000_notify_admin_on_new_signup.sql` | DB trigger + pg_net call to `/api/notifications/new-signup` for admin signup alerts |
| `20260401200000_fix_notify_project_deleted_cascade.sql` | Fix cascade behavior in project deletion notification trigger |
| `20260402100000_widget_errors_table.sql` | Created `widget_errors` table for widget-side error reports (PostHog complement) |
| `20260417000000_trial_starts_on_workspace_creation.sql` | `handle_new_user` no longer sets `trial_ends_at`; trial now starts in `handle_new_workspace_for_user` and `create_workspace` RPC on first-owned-workspace creation (guarded by `trial_ends_at IS NULL`) |
