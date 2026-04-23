# VibeVaults — Pre-Launch Manual Test Plan

Scope: dashboard collaboration, multi-workspace/multi-project, roles (owner/member/client), CRUD. Widget flows are excluded.

Legend: **O** = Owner, **M** = Member, **C** = Client. "User A/B/C" = distinct accounts. All happy paths assume an active trial or paid subscription unless stated.

---

## 1. Workspace CRUD & Switching

| # | Title | Steps | Expected |
|---|---|---|---|
| 1 | Auto-workspace on signup | Sign up a brand-new user via magic link | One workspace auto-created, user is `owner`, `trial_ends_at` is set (~14 days out) |
| 2 | Create second workspace | As O, open workspace switcher → Create | New workspace created, user is owner, `trial_ends_at` on profile unchanged (already set) |
| 3 | Switch workspace persists | Switch from WS-A to WS-B, reload page | WS-B still selected; `selectedWorkspaceId` cookie matches |
| 4 | Switch workspace updates projects list | Switch WS → open projects dropdown | Only that workspace's projects are listed |
| 5 | Rename workspace (owner) | Edit workspace name, save | Name updated; sidebar label updates immediately |
| 6 | Rename workspace — unsaved changes guard | Edit name, navigate away without saving | `beforeunload` warning appears |
| 7 | Upload workspace logo | Upload a PNG | Logo appears in sidebar and workspace switcher |
| 8 | Remove workspace logo | Remove uploaded logo | Default placeholder shown everywhere |
| 9 | Delete workspace with projects | As O, delete a workspace containing projects + feedback | All projects, feedbacks, replies, attachments, invites, members cascade-deleted |
| 10 | Delete only workspace | Owner with a single workspace deletes it | Blocked OR auto-creates a new one — verify behavior is consistent and user isn't stranded |
| 11 | Member cannot rename workspace | As M, open workspace settings | Rename control hidden/disabled; API rejects if forced |
| 12 | Client cannot see workspace settings | As C, try to open `/dashboard/settings` | Redirect or 403; no workspace admin controls |
| 13 | Workspace switcher shows all memberships | User belongs to 3 workspaces (owns 1, member of 1, client of 1) | All three listed with correct role badge |

## 2. Project CRUD

| # | Title | Steps | Expected |
|---|---|---|---|
| 14 | Owner creates project | Create project "Acme" | Project appears in sidebar, `api_key` generated, `website_url` stored |
| 15 | Member creates project | As M, create project | Succeeds; member is not automatically any special role on the project |
| 16 | Client cannot create project | As C, attempt create | UI hidden; API rejects |
| 17 | Rename project | Edit name, save | Name updated in sidebar + feedback list breadcrumb |
| 18 | Rename project — unsaved changes | Edit, navigate away | `beforeunload` warning |
| 19 | Regenerate API key | Regenerate, confirm | New key displayed; old widget script stops working |
| 20 | Enable share link | Toggle sharing on | `share_token` generated; `/share/<token>` renders read-only board |
| 21 | Disable share link | Toggle off | Old `/share/<token>` URL returns not-found/disabled |
| 22 | Share link on downgraded tier | Downgrade from Pro→Starter where sharing not included | Webhook disables sharing automatically |
| 23 | Delete project (owner) | Owner deletes project | Project + feedback + replies + attachments + notifications cascade-deleted |
| 24 | Delete project (member) | Member deletes project | Allowed; owner receives notification + email with deleter's name |
| 25 | Delete project (client) | Client attempts | Blocked |
| 26 | Delete last project in workspace | Delete sole project | Dashboard handles empty-state gracefully (no crash, empty placeholder) |
| 27 | Project count limit enforcement | Create projects up to tier limit, attempt one more | Create blocked with clear upgrade CTA |
| 28 | Duplicate project names same workspace | Create two projects with identical name | Either allowed (both exist) or blocked — behavior must be explicit and documented in UI |

## 3. Member Invites & Acceptance

| # | Title | Steps | Expected |
|---|---|---|---|
| 29 | Invite member by email (new user) | O invites `newuser@x.com` | Email sent; no `auth.users` row yet; `workspace_invites` row created |
| 30 | Invite acceptance via magic link | Invitee clicks email → signs in with same email | Membership created; redirected to workspace; no extra auto-workspace for this user |
| 31 | Invite acceptance via Google OAuth | Same as above using Google | Membership created; profile avatar synced |
| 32 | Invite email mismatch | Invited `a@x.com`, sign in as `b@x.com`, open invite link | Email-mismatch UI shown with sign-out button; no membership created |
| 33 | Invite for existing user | Invite user who already has an account & workspace | Accepts; joins workspace WITHOUT losing own workspace |
| 34 | Invite auto-accept on next login | Invite sent while user is logged out; user logs in normally later | `dashboard/layout.tsx` auto-accepts; workspace list includes new ws |
| 35 | Re-fetch after auto-accept | Immediately after auto-accept, check switcher | New workspace visible (admin client re-fetch, not stale memoized snapshot) |
| 36 | Invite duplicate email | Invite same email twice | Second invite either replaces or is idempotent; no duplicate `workspace_members` rows on accept |
| 37 | Invite already-member | Invite existing member | Blocked with clear message |
| 38 | Invite self | O invites own email | Blocked |
| 39 | Invite with expired/deleted token | Click invite link whose row was deleted | Invalid-invite UI, not a crash |
| 40 | Member-role invite does NOT auto-create workspace | New user accepts member invite | No own workspace auto-created; `trial_ends_at` remains NULL |
| 41 | Owner revokes invite before acceptance | O deletes pending invite, invitee opens link | Invalid-invite state |
| 42 | Invite count limit by tier | Invite up to tier member limit, try one more | Blocked with upgrade CTA |
| 43 | Non-owner cannot invite | M tries to invite a member | UI hidden; API rejects |

## 4. Client Invites (workspace-level)

| # | Title | Steps | Expected |
|---|---|---|---|
| 44 | Invite client | O invites client email for a project | Email sent; client invite is workspace-level but scoped to project(s) visible |
| 45 | Client sees only assigned projects | Client logs in | Sidebar shows only projects they were invited to |
| 46 | Client cannot access sibling project by URL | Client pastes URL of another project in same workspace | 403 / redirect |
| 47 | Client cannot access other workspaces | Client switches workspace | Only workspaces they're invited to appear |
| 48 | Remove client | O revokes client access | Client loses project access immediately; bell + email notification |
| 49 | Re-invite removed client | Re-invite same email | Works; history is preserved or cleanly reset |

## 5. Role-Based Access (hard boundaries)

| # | Title | Steps | Expected |
|---|---|---|---|
| 50 | Member cannot delete workspace | M calls delete API directly | Rejected |
| 51 | Member cannot remove other members | M tries to revoke another member | Rejected |
| 52 | Member CAN delete projects | M deletes a project they did not create | Succeeds; owner notified |
| 53 | Client cannot reply as staff | C replies on feedback | Reply stored with `author_role=client`, not `owner/member` |
| 54 | Client cannot see other clients' metadata | Two clients on same project — C1 opens feedback from C2 | Visibility is only as designed (e.g., can see reply thread but not admin controls) |
| 55 | Owner transfer (if supported) | Attempt transfer / verify N/A | Either works cleanly or UI clearly omits the option |
| 56 | `isWorkspaceOwner` helper enforced | Attempt every owner-only API as M | Every endpoint rejects (single source of truth honored) |
| 57 | `hasActiveAccess` enforced on all gated features | Trial-expired O tries gated features | All blocked uniformly (no bypass page) |

## 6. Multi-Workspace / Multi-Project Isolation

| # | Title | Steps | Expected |
|---|---|---|---|
| 58 | Feedback isolation across projects | Create feedback in Project-A, open Project-B | Not visible in B |
| 59 | Feedback isolation across workspaces | Feedback in WS-A/Proj-A, switch to WS-B | Not visible |
| 60 | Notification isolation | O in WS-A; new feedback in WS-B they don't own | No notification |
| 61 | Cookie-driven switch consistency | User in WS-A with selected Proj-A, switch to WS-B | `selectedProjectId` updates to a valid WS-B project (not stale A id) |
| 62 | Stale selectedProjectId after project deletion | Another user deletes currently-selected project | Dashboard recovers gracefully (picks another / empty state) |
| 63 | Share link does not leak auth | Open `/share/<token>` in incognito | Read-only; no dashboard access; no workspace switcher |
| 64 | Notification deep-link sets cookies | Click bell notification from WS-B while viewing WS-A | `notification-navigation.ts` switches workspace + project cookies before route |

## 7. Feedback & Reply Management (Dashboard)

| # | Title | Steps | Expected |
|---|---|---|---|
| 65 | List feedbacks | Open project with mixed statuses | All items listed, default sort is stable |
| 66 | Status filter | Filter by "completed" | Only completed shown |
| 67 | Change feedback status | Owner moves feedback new→completed | Updates optimistically; DB reflects; other users see via Realtime |
| 68 | Reply to feedback (owner) | Post reply | Reply appears; reply count increments; widget user gets email (if real) |
| 69 | Reply self-notification prevention | O replies; O has email prefs on | O does NOT receive their own reply email |
| 70 | Reply with attachment | Attach 2MB image | Presigned URL flow succeeds; attachment renders in thread |
| 71 | Reply with oversized attachment | Attempt 12MB upload | Blocked client-side and server-side (confirm verifies actual size) |
| 72 | Reply with disallowed MIME | Upload `.exe` | Rejected at confirm step |
| 73 | Delete feedback (owner) | Delete a thread | Cascade deletes replies + attachments; linked notifications become "deleted-feedback" toast targets |
| 74 | Notification to deleted feedback | Click old bell notification pointing at deleted feedback | `feedback-deleted-toast.tsx` shown — no 404 crash |
| 75 | Concurrent reply (two staff) | O and M reply within seconds | Both persisted in order; both see each other's via Realtime |
| 76 | Concurrent status change | O and M flip status simultaneously | Last write wins without error; no duplicate notifications |
| 77 | Highlight on hash nav | Open `/dashboard/feedback#<id>` | Correct card pulsates + overlay |
| 78 | HTML-escaped content in email | Submit feedback containing `<script>` and open digest email | Escaped; renders as text |
| 79 | Feedback attachment from deleted project | Project deleted while user viewing attachment | Graceful 404 handling |

## 8. Notifications (bell + email + digest)

| # | Title | Steps | Expected |
|---|---|---|---|
| 80 | New-feedback bell | External widget submits feedback | Bell badge increments in real time for all staff |
| 81 | Digest window | Two feedbacks within 15 min to same recipient/project | First email immediate; second queued; cron sends batched |
| 82 | Reply cooldown | Two replies within 10 min on same thread to same recipient | First immediate; second queued |
| 83 | Realtime frequency (future) | Set `email_frequency=realtime` | Each event emails immediately (if feature enabled) |
| 84 | Localhost email suppression | Dev env, submit feedback | No emails sent regardless of prefs |
| 85 | Project-created notification | M creates project | O gets bell + email |
| 86 | Project-deleted notification with deleter name | M deletes project | O email contains deleter's name |
| 87 | Workspace-level notification with null project_id | Trigger member-departed | Stored with `project_id = NULL`; bell renders without crash |
| 88 | Notification preferences honored | Disable reply emails | No reply emails; bell still updates |
| 89 | Deleted project queued digest | Project deleted with pending queue items | Cron processes without crash (FK is nullable) |

## 9. Member Departure & Removal

| # | Title | Steps | Expected |
|---|---|---|---|
| 90 | Member leaves workspace | M clicks "Leave" | Membership removed; O gets email + bell + toast |
| 91 | Owner revokes member | O removes M | M loses access instantly; M gets email + bell + toast |
| 92 | Removed member loses selected-workspace cookie | After revocation, M reloads | Redirected; no stale access |
| 93 | `notifyOwnerMemberDeparted` on account deletion | M deletes own account | O gets notification with `reason: 'account_deleted'` |
| 94 | Last owner cannot leave own workspace | O attempts leave | Blocked with clear message |
| 95 | Member leaves then rejoins via new invite | M leaves, O re-invites | Clean rejoin; old notifications/audit preserved |

## 10. Account Deletion Safety

| # | Title | Steps | Expected |
|---|---|---|---|
| 96 | Owner deletes account with members | O with active M deletes account | Workspace + projects cascade; M notified; M's own workspace (if any) untouched |
| 97 | Member deletes account | M deletes account | Owners notified; workspaces they owned are untouched; client access they had is revoked |
| 98 | Client deletes account | C deletes | Invites/memberships cleared; no orphaned rows |
| 99 | Post-deletion localStorage clear | Delete account, sign up with new email same browser | No stale `selectedWorkspaceId`/cookies bleed into new session |
| 100 | Cascade covers `email_preferences` | Delete account | `email_preferences` row for that email also removed |
| 101 | Stripe subscription on delete | O with active sub deletes account | Subscription cancelled (or flagged) — no silent ongoing charges |

## 11. Trial & Subscription Gates Affecting Collaboration

| # | Title | Steps | Expected |
|---|---|---|---|
| 102 | Trial-expired owner, invites disabled | Force `trial_ends_at` past | Invite UI blocked; `/dashboard/subscribe` CTA shown |
| 103 | Member of expired-trial owner | M on an owner whose trial expired | M also loses dashboard features dependent on owner's access (consistent with `hasActiveAccess(owner)`) |
| 104 | Member with NULL `trial_ends_at` not mislabeled | New member never owned a workspace | Sidebar tier badge hidden; NOT shown as "trial expired" |
| 105 | Downgrade enforces member limit | Pro (5 members) → Starter (1 member) | Webhook removes excess or blocks new adds; UI shows which are disabled |
| 106 | Duplicate Stripe checkout blocked | Already-subscribed O clicks upgrade | Redirected to Customer Portal |
| 107 | Checkout success without webhook | Complete checkout, block webhook | `syncProfileFromCheckoutSession` on success page backfills; user not stranded |
| 108 | Owner upgrades mid-trial | O subscribes during trial | Access uninterrupted; trial badge replaced with tier badge |

## 12. Realtime Collaboration Edge Cases

| # | Title | Steps | Expected |
|---|---|---|---|
| 109 | Two browsers same user | O signs into two tabs | Both receive realtime events; no duplicate writes |
| 110 | Role downgrade mid-session | O demotes M to client while M is active | M's dashboard reflects reduced access within seconds (or on next action) — no forbidden data leaks |
| 111 | Member added mid-session | O adds M while M is logged in | M's workspace switcher picks up new workspace without re-login (or on refresh — document) |
| 112 | Realtime survives after cookie refresh | Long-lived tab past access-token refresh | WS reconnects; no 431 (tokens-only encoding working) |
| 113 | Oversized cookie regression check | Sign in with Google, verify cookie size | < 4KB; Realtime WS upgrades succeed |

## 13. UI Consistency & Safety Nets

| # | Title | Steps | Expected |
|---|---|---|---|
| 114 | All destructive dialogs use same `AlertDialog` | Delete workspace, project, member, account | Consistent visuals + confirm text pattern |
| 115 | All cards use shared Shadcn styling | Visit settings, billing, feedback list | No visual drift between cards |
| 116 | `beforeunload` on all edit forms | Edit workspace, edit project, account settings | Warning on nav away with unsaved changes |
| 117 | Global error boundary | Force a render error in a page | `global-error.tsx` renders; PostHog receives event |
| 118 | Server error capture | Force 500 in an API route | `instrumentation.ts` forwards to PostHog |
| 119 | Notification bell empty state | New account, no notifications | Empty state renders cleanly |

## 14. Share Board (public read-only)

| # | Title | Steps | Expected |
|---|---|---|---|
| 120 | Public share view loads without auth | Open `/share/<token>` incognito | Read-only list of feedback |
| 121 | Share view hides private fields | Inspect payload | No emails, no internal author metadata leaked |
| 122 | Disabled share returns 404-like state | Disable sharing, reload share URL | Friendly not-found page |

---

## Regression Smoke (run before every release)

1. Sign up new user → auto workspace + trial set (#1, #40)
2. Create project, toggle sharing, open share link (#14, #20, #120)
3. Invite member (new email) → accept via magic link → shows in switcher (#29, #30, #35)
4. Invite client → client sees only that project (#44, #45, #46)
5. Submit widget feedback externally, reply from dashboard, verify bell + email digest (#68, #80, #81)
6. Delete project as member; owner gets email with deleter's name (#24, #86)
7. Member leaves; owner notified (#90)
8. Owner deletes account; member notified, cascades clean (#96, #100, #101)
9. Trial-expired owner blocked from invites + gated features (#102, #57)
10. Stripe upgrade → Customer Portal for repeat checkout (#106)
