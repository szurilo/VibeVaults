# VibeVaults — CLAUDE.md

## Project Overview
**VibeVaults** is a B2B SaaS feedback widget platform. Website owners embed `public/widget.js` to collect user feedback and engage clients in real-time chat. Multi-workspace, multi-project, role-based (owner/member/client).

## Tech Stack
- **Framework**: Next.js 16.1.4 (App Router, Turbopack) + React 19
- **Styling**: Tailwind CSS v4 + Shadcn/UI (Radix) + Framer Motion + Lucide
- **Backend/DB**: Supabase (PostgreSQL, Auth, Realtime) — Docker locally, Supabase Cloud in prod
- **Auth**: Magic Link (OTP) + Cloudflare Turnstile for anti-bot
- **Emails**: Resend (transactional + notifications)
- **Payments**: Stripe — mandatory 14-day paid trial, NO free tier
- **Proxy**: `src/proxy.ts` (NOT `middleware.ts` — Next.js 16+ paradigm)
- **Analytics**: Vercel Analytics + Speed Insights
- **Tests**: Playwright E2E (`tests/`)

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
- Users auto-get a workspace on signup (DB trigger `handle_new_workspace_for_user`)
- `workspace_members` table: roles are `owner`, `member`, `client`
- Cookie-based state: `selectedWorkspaceId`, `selectedProjectId`
- Invites auto-accepted in `dashboard/layout.tsx` on login

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
- **File uploads**: `/api/widget/upload` + `/api/dashboard/upload` → Supabase Storage (`feedback-attachments` bucket), 10MB/file, 10 files/request
- **Email safety**: All user content in emails sanitized via `esc()` in `lib/notifications.ts`

### Notification System
- DB triggers: `notify_new_feedback`, `notify_new_reply`, `notify_project_created`
- In-app: `GlobalNotificationProvider` + `NotificationBell` via Supabase Realtime
- Email: Resend via `lib/notifications.ts` with per-user preferences

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
| `email_preferences` | `email`, `notify_replies`, `notify_new_feedback`, `notify_project_created` |
| `feedback_attachments` | `id`, `feedback_id`, `reply_id`, `project_id`, `file_name`, `file_url`, `file_size`, `mime_type`, `uploaded_by` |

## API Routes
| Route | Method | Purpose |
|---|---|---|
| `/api/widget` | GET/POST | Widget config + feedback submission |
| `/api/widget/verify-email` | GET | Lightweight email authorization check for widget |
| `/api/widget/feedbacks` | GET | List feedbacks for widget (includes reply_count) |
| `/api/widget/reply` | POST | Widget reply submission |
| `/api/widget/upload` | POST | Widget file attachment upload |
| `/api/widget/stream` | GET | SSE real-time chat stream |
| `/api/dashboard/upload` | POST | Dashboard file attachment upload |
| `/api/projects` | POST | Create project |
| `/api/workspaces/invites` | POST | Create workspace invite |
| `/api/stripe/checkout` | POST | Stripe checkout |
| `/api/stripe/webhook` | POST | Stripe webhook |
| `/api/auth/callback` | GET | Supabase auth callback |
| `/api/auth/turnstile` | POST | Turnstile verification |
