# Manual Test Checklist — Workspace-Scoped Paywall + Switcher

Covers the paywall-scoping rework, always-on workspace switcher, tier badge visibility, and the create-workspace reload flow.

## Fixture setup

You'll need the following accounts. Re-use seeds where possible; otherwise set `profiles.trial_ends_at` directly in the DB to force states.

| Alias | Role | State |
|---|---|---|
| **A-owner-active** | Owns W-A | Trial active OR subscribed |
| **A-owner-expired** | Owns W-A-exp | `trial_ends_at` in the past, no Stripe sub |
| **B-owner-active** | Owns W-B | Subscribed |
| **M-invited-only** | Member of W-B (invited by B) | Never owned a workspace → `trial_ends_at = NULL` |
| **H-hybrid-expired** | Owns W-H (expired) **and** member of W-B | `trial_ends_at` past, no sub |

To force expiry fast:
```sql
UPDATE profiles SET trial_ends_at = now() - interval '1 day'
WHERE email = '<user>';
```

---

## 1. Proxy paywall scope (critical)

| # | Steps | Expect |
|---|---|---|
| 1.1 | Log in as **A-owner-expired** (no invited workspaces), visit `/dashboard` | Redirects to `/dashboard/subscribe` |
| 1.2 | Log in as **M-invited-only**, visit `/dashboard` | Loads normally, no redirect (trial never started) |
| 1.3 | Log in as **H-hybrid-expired**, clear `selectedWorkspaceId` cookie, visit `/dashboard` | Lands on W-B (invited) — NOT subscribe page |
| 1.4 | As **H-hybrid-expired**, set `selectedWorkspaceId` cookie to W-H id, visit `/dashboard` | Redirects to `/dashboard/subscribe` |
| 1.5 | As **H-hybrid-expired**, set `selectedWorkspaceId` cookie to W-B id, visit `/dashboard` | Loads normally |
| 1.6 | Visit `/dashboard/account` while expired+owned-selected | Loads normally (account path excluded from paywall) |
| 1.7 | Visit `/dashboard/subscribe` while on expired+owned-selected | Loads normally (no redirect loop) |

## 2. Sidebar lock behavior

| # | Context | Expect |
|---|---|---|
| 2.1 | **A-owner-active** on own workspace | Full sidebar enabled |
| 2.2 | **H-hybrid-expired** on W-B (invited) | Full sidebar enabled, no lock icons |
| 2.3 | **H-hybrid-expired** on W-H (owned) → `/subscribe` | Workspace switcher **clickable**; Users/Settings and Projects group **dimmed + pointer-events-none** |
| 2.4 | From 2.3, open switcher | Own workspace shows 🔒 lock icon; invited workspace does not |
| 2.5 | From 2.3, click W-B (invited) | Page reloads to full access, sidebar un-dims, switcher shows W-B active |
| 2.6 | From 2.5, click W-H (owned) in switcher | Hard reload to `/dashboard/subscribe`, sidebar dims correctly, switcher shows W-H active |

## 3. Tier badge + CTA visibility

| # | User | Expect in footer |
|---|---|---|
| 3.1 | **A-owner-active** (trialing) | `Trial (Pro)` badge (amber crown) + `Subscribe` link |
| 3.2 | **A-owner-active** (paid Starter) | `Starter` badge + `Upgrade` link |
| 3.3 | **A-owner-active** (paid Business) | `Business` badge, **no** upgrade link |
| 3.4 | **A-owner-expired** | `Expired` badge (red crown + red text) + `Subscribe` link |
| 3.5 | **M-invited-only** | **No** tier badge, **no** CTA (they don't own anything) |
| 3.6 | **H-hybrid-expired** on W-B | `Expired` badge still visible (they own W-H) + Subscribe link |

## 4. Create first workspace (member → owner)

| # | Steps | Expect |
|---|---|---|
| 4.1 | Log in as **M-invited-only**, on W-B dashboard | No tier badge, "Create Workspace" item in switcher shows trial info block in dialog |
| 4.2 | Create "My First WS" via dialog | No runtime error flash ("Error in inputstream"), dialog closes |
| 4.3 | After 4.2 | Switcher shows **"My First WS"** as active (not W-B) |
| 4.4 | After 4.2 | Footer now shows `Trial (Pro)` badge + Subscribe link |
| 4.5 | After 4.2 | Onboarding checklist visible for the new owner |
| 4.6 | Reload page | State persists; still on "My First WS" |

## 5. Create additional workspace (existing owner)

| # | Steps | Expect |
|---|---|---|
| 5.1 | As **A-owner-active**, create second workspace | Switcher auto-switches to new one, no errors |
| 5.2 | Dialog trial-info block | Absent (not their first) |

## 6. Default-workspace selection on login

| # | User | No cookie | Expect landing |
|---|---|---|---|
| 6.1 | **A-owner-active** | Yes | Their workspace (first owned) |
| 6.2 | **H-hybrid-expired** | Yes | Invited W-B (not owned-expired W-H) |
| 6.3 | **A-owner-expired** (no invites) | Yes | Own workspace → proxy kicks to `/subscribe` |
| 6.4 | Any user with valid cookie | Cookie points at still-valid ws | Honors cookie |
| 6.5 | Any user with stale cookie (workspace removed) | Cookie invalid | Falls back to rule 6.1–6.3 |

## 7. Invite acceptance edge cases

| # | Steps | Expect |
|---|---|---|
| 7.1 | Invite **A-owner-expired**'s email to W-B, then they log in | Auto-accept, land on W-B (now invited), sidebar fully enabled on W-B |
| 7.2 | From 7.1, switch to W-A-exp | Redirect to `/subscribe` + sidebar dims |

## 8. Subscribe page copy

| # | Context | Expected heading/copy |
|---|---|---|
| 8.1 | **A-owner-expired** (no invites) | "Your trial has expired" + generic copy |
| 8.2 | **H-hybrid-expired** | "Your trial has expired" + mentions invited workspaces remain accessible |
| 8.3 | **A-owner-active** (trialing) | "Choose your plan" + `N days left` |
| 8.4 | Paid Starter | "Upgrade your plan" |

## 9. Regression spot-checks

- [ ] Widget still loads on an invited user's project while the user's own trial is expired (owner of that project pays)
- [ ] Widget blocked on A-owner-expired's own project (`validateApiKey` gate)
- [ ] Subscribing via Stripe (A-owner-expired → Starter) restores full sidebar on next load
- [ ] Downgrading via Stripe portal doesn't break any of the above

---

## Browser devtools helpers

Clear workspace cookie:
```js
document.cookie = 'selectedWorkspaceId=; path=/; max-age=0';
document.cookie = 'selectedProjectId=; path=/; max-age=0';
```

Force a specific workspace:
```js
document.cookie = 'selectedWorkspaceId=<uuid>; path=/; max-age=31536000';
location.reload();
```
