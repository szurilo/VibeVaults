# VibeVaults - Project Summary

## 1. Project Overview & State
**VibeVaults** is a B2B SaaS application providing an embeddable feedback widget (`public/widget.js`) for clients to seamlessly collect user feedback and engage in real-time chat directly from their websites. It supports multi-workspace, multi-project architecture with role-based access (owners, team members, clients).
**Current State**: In active development (mostly functional) — currently focused on security hardening, file attachment support, widget abuse prevention (rate limiting, content limits), trial enforcement, and continuous UI/UX dashboard refinement.

## 2. Architecture & Tech Stack
- **Frontend**: Next.js 16.1.4 (App Router, Turbopack) combined with React 19.
- **Styling & UI Components**: Tailwind CSS v4, Shadcn/UI (Radix components), Framer Motion for animations, and Lucide React for icons.
- **Backend/Database**: Supabase (PostgreSQL, Auth, Realtime) — local Docker instance for development, Supabase cloud for production.
- **Widget Flow**: A lightweight Vanilla JS script (`public/widget.js`) embedded on client sites, interacting with Next.js API routes (`/api/widget/*`) and SSE streams.
- **Communications**: Server-Sent Events (SSE) via `/api/widget/stream` and Supabase Realtime power the live chat, broadcasting instant replies to dashboard views and widget instances.
- **Authentication**: Supabase Magic Link (OTP) with client-side verification handlers (edge-case email link scanner bypass). Turnstile for anti-bot on public forms.
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
- **Workspace Architecture (Multi-Owned, Multi-Joined)**: Evolved the Workspace and Project hierarchy to allow users to create and own multiple workspaces securely (via RPC `create_workspace`), as well as delete their own workspaces. They can also join unlimited additional workspaces via invitation. Cookie-based state persistence (`selectedWorkspaceId`, `selectedProjectId`) navigates these environments across the dashboard.
- **Team Member & Client Invites**: Comprehensive invitation system supporting both `member` and `client` roles. Team members get access to all projects in a workspace. Clients can review specific projects. Auto-acceptance of pending invites happens in `dashboard/layout.tsx` on login. RLS policies use `SECURITY DEFINER` helper functions (like `get_client_project_ids()`) to securely allow invited clients to view and interact with feedbacks.
- **RLS & Database Security**: Resolved infinite recursion (`42P17`) bugs in Supabase Row Level Security by refactoring policies to use `SECURITY DEFINER` helper functions (`get_user_workspaces()`). This securely resolves client/agency authorizations without circular foreign key table locks.
- **Onboarding Refactor**: Complete overhaul of `Onboarding.tsx` to a role-specific checklist system:
  - **Owners** see 8 steps: Create project (opens `CreateProjectDialog`), Embed widget, Invite members, Invite clients, Create feedback, Customize workspace, Customize project, Share board. Three steps marked as ⭐ Recommended.
  - **Members** see 1 step: Create Feedback as a Team member.
  - Checklist auto-completes (`has_onboarded = true`) only when all items are checked.
  - Dismissible into a persistent **mini-banner** (`localStorage`-backed collapsed state) with a Resume button.
  - "Go" links navigate to anchor-highlighted target cards using `AnchorHighlight` component (JS-driven glow animation, since CSS `:target` doesn't work with Next.js client-side routing).
  - `completed_onboarding_steps` text array column added to `profiles` table (migration `20260306234000`).
  - Members who create their first workspace get onboarding reset to show the owner checklist.
  - Workspaces are auto-created for new owners on signup — no manual "Create Workspace" step in onboarding.
- **Shared CreateProjectDialog**: Extracted the "Create Project" dialog (`CreateProjectDialog.tsx`) into a shared component used by both `ProjectSwitcher` and `Onboarding`, eliminating code duplication.
- **AnchorHighlight Component**: Reusable client component (`AnchorHighlight.tsx`) that detects `window.location.hash` on mount, scrolls to the target, and applies a gentle glow animation. Used on project-settings, workspace settings, and users pages.
- **Notification System**: Real-time in-app notifications via `GlobalNotificationProvider` and `NotificationBell`, with Supabase Realtime subscriptions. Email notification preferences configurable per-project (`NotificationsCard`).
- **Public Sharing**: Read-only project board sharing via tokenised links (`/share/[token]`). Managed in `ShareProjectCard` with server actions in `actions/project-sharing.ts`.
- **UI/UX Refinements**: Continuous focus on premium aesthetic. Polished feedback widget UX (clean resets of text/screenshots), solved visual overflows in notifications, standardised components. Renamed "Team" to "Users" across the UI.
- **E2E Testing**: Playwright-based end-to-end test infrastructure (`tests/dashboard.spec.ts`, `tests/feedback-flow.spec.ts`) with GitHub Actions CI integration.
- **Copywriting / Promotional Expansion**: Refining the landing page (`src/app/page.tsx`) to effectively promote product selling points and encourage sign-ups.
- **File Attachments**: Full attachment support for feedbacks and replies. New `feedback_attachments` table stores file metadata (name, URL, size, MIME type, uploader). Files stored in Supabase Storage (`feedback-attachments` bucket). Two upload routes: `/api/widget/upload` (validates API key + sender invite) and `/api/dashboard/upload` (authenticated user + RLS). Widget and dashboard both support file upload with preview. Feedback card shows image thumbnails with lightbox viewer and non-image files as download links. Real-time attachment updates via Supabase Realtime. Constraints: 10MB max per file, 10 files per request, MIME type allowlist (images, PDFs, Office docs, text/csv).
- **Widget Security & Abuse Prevention**:
  - **Rate Limiting**: In-memory per-IP rate limiter (30 req/min) in `src/lib/widget-helpers.ts`, applied to all widget API endpoints. Auto-cleans expired entries every 5 minutes.
  - **Content Length Limits**: 5000 character max for feedback and reply content, enforced server-side.
  - **Trial/Subscription Gate**: `validateApiKey()` now checks workspace owner's `subscription_status` and `trial_ends_at` — widget returns 403 if trial expired and no active subscription.
  - **HTML Injection Fix**: All user-generated content in email templates sanitized via `esc()` function in `src/lib/notifications.ts` (escapes `&`, `<`, `>`, `"`).
- **Subscribe Page**: New `/dashboard/subscribe` page shown when trial expires. Displays "Your trial has expired" with options to subscribe (Stripe checkout) or log out.
- **Client Workspace Trigger Fix**: Updated `handle_new_workspace_for_user()` DB trigger — only skips default workspace creation for `member` invites, not `client` invites. Clients still get their own workspace.

## 5. Key Components Reference
| Component | Path | Purpose |
|---|---|---|
| `Onboarding` | `src/components/Onboarding.tsx` | Role-specific onboarding checklist with collapse/expand |
| `CreateProjectDialog` | `src/components/CreateProjectDialog.tsx` | Shared project creation dialog (sidebar & onboarding) |
| `AnchorHighlight` | `src/components/AnchorHighlight.tsx` | Wraps cards with anchor IDs, glow on hash navigation |
| `ProjectSwitcher` | `src/components/ProjectSwitcher.tsx` | Sidebar project dropdown with create option |
| `WorkspaceSwitcher` | `src/components/WorkspaceSwitcher.tsx` | Sidebar workspace dropdown with create option |
| `AppSidebar` | `src/components/AppSidebar.tsx` | Main dashboard sidebar layout |
| `UserManagement` | `src/components/UserManagement.tsx` | Users page: member list, invite form, leave/revoke |
| `feedback-card` | `src/components/feedback-card.tsx` | Feedback detail card with real-time chat, status, replies |
| `GlobalNotificationProvider` | `src/components/GlobalNotificationProvider.tsx` | Real-time notification context via Supabase Realtime |
| `NotificationBell` | `src/components/NotificationBell.tsx` | Header notification dropdown with live updates |
| `EmbedWidgetCard` | `src/components/EmbedWidgetCard.tsx` | Widget embed code snippet card |
| `ShareProjectCard` | `src/components/ShareProjectCard.tsx` | Public board sharing with token management |
| `WorkspaceSettingsCard` | `src/components/WorkspaceSettingsCard.tsx` | Workspace branding & settings |
| `EditProjectCard` | `src/components/EditProjectCard.tsx` | Project name/URL editing |
| `AddFeedbackDialog` | `src/components/AddFeedbackDialog.tsx` | Manual feedback creation dialog |

## 6. API Routes
| Route | Method | Purpose |
|---|---|---|
| `/api/widget` | GET/POST | Widget config + feedback submission |
| `/api/widget/feedbacks` | GET | List feedbacks for widget (includes reply_count) |
| `/api/widget/reply` | POST | Submit reply from widget chat |
| `/api/widget/upload` | POST | Upload attachments from widget |
| `/api/widget/stream` | GET | SSE stream for real-time chat |
| `/api/dashboard/upload` | POST | Upload attachments from dashboard |
| `/api/projects` | POST | Create new project |
| `/api/workspaces/invites` | POST | Create workspace invite |
| `/api/auth/callback` | GET | Supabase auth callback handler |
| `/api/auth/turnstile` | POST | Turnstile token verification |
| `/api/stripe/checkout` | POST | Stripe checkout session |
| `/api/stripe/webhook` | POST | Stripe webhook handler |

## 7. Server Actions
| Action | Path | Purpose |
|---|---|---|
| `completeOnboardingAction` | `src/actions/onboarding.ts` | Mark onboarding as complete |
| `toggleOnboardingStepAction` | `src/actions/onboarding.ts` | Toggle individual checklist steps |
| `createWorkspaceAction` | `src/actions/workspaces.ts` | Create workspace (resets onboarding for members) |
| `updateFeedbackStatusAction` | `src/actions/feedback.ts` | Update feedback status |
| `toggleShareAction` | `src/actions/project-sharing.ts` | Enable/disable public board sharing |
| `updateEmailPreferencesAction` | `src/actions/preferences.ts` | Update per-project email preferences |

## 8. Database Schema (Key Tables)
| Table | Purpose |
|---|---|
| `profiles` | User profiles, onboarding state (`has_onboarded`, `completed_onboarding_steps`), preferences |
| `workspaces` | Multi-tenant workspaces with branding (name, logo) |
| `workspace_members` | User ↔ workspace association with role (`owner`, `member`, `client`) |
| `workspace_invites` | Pending invitations with email, role, workspace reference |
| `projects` | Projects within workspaces (name, `website_url`) |
| `feedbacks` | User-submitted feedback entries with status, metadata, screenshots |
| `feedback_replies` | Threaded replies on feedback items (real-time enabled) |
| `notifications` | In-app notification records |
| `email_preferences` | Per-user email notification preferences |
| `feedback_attachments` | File attachments for feedbacks/replies (name, URL, size, MIME type, uploader) |
