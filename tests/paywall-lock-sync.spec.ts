/**
 * Three things a locked-out user experiences, none of which the server-side
 * gate alone gets right:
 *
 * 1. The sidebar lock must appear on the SAME navigation the paywall redirect
 *    happens on, without a manual refresh. /dashboard/subscribe shares the
 *    /dashboard layout and the App Router caches layout segments, so a
 *    redirected soft navigation swaps only the page segment and reuses the
 *    cached (pre-expiry) sidebar — the nav looks fully enabled while every
 *    click bounces back to the paywall.
 * 2. "Create Workspace" must be locked for a lapsed owner (a new workspace
 *    would be born locked) but must stay OPEN for an invited member who has
 *    never owned one, since creating their first workspace is what starts their
 *    trial — and is their only escape from a workspace someone else stopped
 *    paying for.
 * 3. /dashboard/settings/users must stay reachable while locked out: it hosts
 *    the only exits (a member leaving, an owner removing a member or revoking a
 *    client). Inviting is what gets dropped instead.
 *
 * Not covered here: the server-side guard inside `createWorkspaceAction`. Server
 * actions aren't HTTP-addressable, so Playwright can't invoke one directly the
 * way it can the API routes in `workspace-paused.spec.ts`. The UI lock below is
 * what's pinned; the action guard is defence-in-depth behind it.
 */

import { test, expect } from '@playwright/test';
import { supabaseAdmin } from './utils/supabase-admin';
import { getSeedResult } from './utils/seed-result';
import { AUTH_FILES } from './fixtures/test-data';

test.describe.configure({ mode: 'serial' });

const yesterday = () => new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

test.describe('paywall lock appears without a refresh', () => {
    let originalTrialEndsAt: string | null = null;
    let originalStatus: string | null = null;
    let originalTier: string | null = null;

    test.beforeAll(async () => {
        const seed = getSeedResult();
        const { data } = await supabaseAdmin
            .from('profiles')
            .select('trial_ends_at, subscription_status, subscription_tier')
            .eq('id', seed.ownerId)
            .single();
        originalTrialEndsAt = data?.trial_ends_at ?? null;
        originalStatus = data?.subscription_status ?? null;
        originalTier = data?.subscription_tier ?? null;
    });

    test.afterAll(async () => {
        const seed = getSeedResult();
        await supabaseAdmin
            .from('profiles')
            .update({
                trial_ends_at: originalTrialEndsAt,
                subscription_status: originalStatus,
                subscription_tier: originalTier,
            })
            .eq('id', seed.ownerId);
    });

    test('trial expiring mid-session locks the sidebar on the redirected click', async ({ page }) => {
        const seed = getSeedResult();

        // 1. Owner is working happily, trial still valid.
        await supabaseAdmin
            .from('profiles')
            .update({
                trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
                subscription_status: null,
                subscription_tier: null,
            })
            .eq('id', seed.ownerId);

        await page.goto('/dashboard');
        await page.waitForLoadState('networkidle');

        await expect(page.getByRole('link', { name: /^Users$/ })).toBeVisible({ timeout: 10_000 });
        await expect(page.locator('[data-locked="true"]')).toHaveCount(0);

        // 2. Trial lapses while the tab stays open.
        await supabaseAdmin
            .from('profiles')
            .update({ trial_ends_at: yesterday() })
            .eq('id', seed.ownerId);

        // 3. A soft navigation — exactly what clicking a sidebar item does.
        await page.getByRole('link', { name: /^Overview$/ }).click();
        await page.waitForURL(/\/dashboard\/subscribe/, { timeout: 10_000 });

        // 4. The sidebar must reflect the lock now, with no manual refresh.
        await expect(page.locator('[data-locked="true"]').first()).toBeVisible({ timeout: 10_000 });
    });

    test('a healthy owner visiting subscribe voluntarily keeps a usable sidebar', async ({ page }) => {
        const seed = getSeedResult();
        await supabaseAdmin
            .from('profiles')
            .update({
                trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
                subscription_status: null,
                subscription_tier: null,
            })
            .eq('id', seed.ownerId);

        // Reached from the footer's Subscribe/Upgrade link, not forced. Dimming
        // the nav here would strand a paying customer on the pricing page.
        await page.goto('/dashboard/subscribe');
        await page.waitForLoadState('networkidle');

        await expect(page.locator('[data-locked="true"]')).toHaveCount(0);
    });

    test('lapsed owner: Create Workspace is locked and routes to the paywall', async ({ page }) => {
        const seed = getSeedResult();
        await supabaseAdmin
            .from('profiles')
            .update({ trial_ends_at: yesterday(), subscription_status: null, subscription_tier: null })
            .eq('id', seed.ownerId);

        await page.goto('/dashboard/subscribe');
        await page.waitForLoadState('networkidle');

        await page.getByRole('button', { name: /Current Workspace/i }).click();

        const createItem = page.getByRole('menuitem', { name: /Create Workspace/i });
        await expect(createItem).toBeVisible({ timeout: 10_000 });
        // Locked rather than hidden, so the reason is visible.
        await expect(createItem).toHaveAttribute('title', /subscribe/i);

        await createItem.click();
        await page.waitForURL(/\/dashboard\/subscribe/, { timeout: 10_000 });

        // No create dialog — the click must not open the form.
        await expect(page.getByRole('dialog')).toHaveCount(0);
    });

    test('lapsed owner can still reach user management to trim their team', async ({ page }) => {
        const seed = getSeedResult();
        await supabaseAdmin
            .from('profiles')
            .update({ trial_ends_at: yesterday(), subscription_status: null, subscription_tier: null })
            .eq('id', seed.ownerId);

        // Must NOT redirect — this is where removing a member and revoking a
        // client live.
        await page.goto('/dashboard/settings/users');
        await page.waitForLoadState('networkidle');
        expect(page.url()).toContain('/dashboard/settings/users');

        // Roster still rendered, inviting dropped.
        await expect(page.getByText(/inviting is paused/i)).toBeVisible({ timeout: 10_000 });
        await expect(page.getByRole('button', { name: /Send Invite/i })).toHaveCount(0);
    });
});

test.describe('member exits stay reachable while locked out', () => {
    test.use({ storageState: AUTH_FILES.member });

    let originalTrialEndsAt: string | null = null;
    let originalStatus: string | null = null;
    let originalTier: string | null = null;

    test.beforeAll(async () => {
        const seed = getSeedResult();
        const { data } = await supabaseAdmin
            .from('profiles')
            .select('trial_ends_at, subscription_status, subscription_tier')
            .eq('id', seed.ownerId)
            .single();
        originalTrialEndsAt = data?.trial_ends_at ?? null;
        originalStatus = data?.subscription_status ?? null;
        originalTier = data?.subscription_tier ?? null;

        await supabaseAdmin
            .from('profiles')
            .update({ trial_ends_at: yesterday(), subscription_status: null, subscription_tier: null })
            .eq('id', seed.ownerId);
    });

    test.afterAll(async () => {
        const seed = getSeedResult();
        await supabaseAdmin
            .from('profiles')
            .update({
                trial_ends_at: originalTrialEndsAt,
                subscription_status: originalStatus,
                subscription_tier: originalTier,
            })
            .eq('id', seed.ownerId);
    });

    test('member can open user management for a paused workspace and leave it', async ({ page, context }) => {
        const seed = getSeedResult();
        await context.addCookies([{
            name: 'selectedWorkspaceId',
            value: seed.workspaceId,
            url: 'http://127.0.0.1:3000',
        }]);

        await page.goto('/dashboard/settings/users');
        await page.waitForLoadState('networkidle');

        // Not redirected to the paused page — this is the exit.
        expect(page.url()).toContain('/dashboard/settings/users');
        await expect(page.getByText(/this workspace is paused/i)).toBeVisible({ timeout: 10_000 });

        // The exit itself must still be offered.
        await expect(page.getByRole('button', { name: /Leave Workspace/i }).first()).toBeEnabled();
    });

    test('the sidebar Users item reaches the exit while locked out', async ({ page, context }) => {
        const seed = getSeedResult();
        await context.addCookies([{
            name: 'selectedWorkspaceId',
            value: seed.workspaceId,
            url: 'http://127.0.0.1:3000',
        }]);

        await page.goto('/dashboard/workspace-paused');
        await page.waitForLoadState('networkidle');

        // The sidebar is where people look for team/leave controls. Linking it
        // only from the paywall page hid it where nobody searches.
        await page.getByRole('link', { name: /^Users$/ }).click();
        await page.waitForURL(/\/dashboard\/settings\/users/, { timeout: 10_000 });
        await expect(page.getByRole('button', { name: /Leave Workspace/i }).first()).toBeEnabled();
    });

    test('the paused page links to that exit', async ({ page, context }) => {
        const seed = getSeedResult();
        await context.addCookies([{
            name: 'selectedWorkspaceId',
            value: seed.workspaceId,
            url: 'http://127.0.0.1:3000',
        }]);

        await page.goto('/dashboard/workspace-paused');
        await page.waitForLoadState('networkidle');

        // Without this link the exit is reachable only by typing a URL, since
        // the sidebar nav is dimmed.
        const leaveLink = page.getByRole('link', { name: /leave this workspace/i });
        await expect(leaveLink).toBeVisible({ timeout: 10_000 });
        await expect(leaveLink).toHaveAttribute('href', '/dashboard/settings/users');
    });

    test('no tier badge or Subscribe CTA while viewing a paused invited workspace', async ({ page, context }) => {
        const seed = getSeedResult();
        await context.addCookies([{
            name: 'selectedWorkspaceId',
            value: seed.workspaceId,
            url: 'http://127.0.0.1:3000',
        }]);

        await page.goto('/dashboard/workspace-paused');
        await page.waitForLoadState('networkidle');

        // The seeded member owns a workspace of their own, so they DO have a tier
        // badge in other contexts. It must not appear here: a Subscribe button
        // beside "this workspace is paused" reads as "pay to unlock it", and
        // their subscription cannot unlock a workspace someone else owns.
        await expect(page.getByRole('link', { name: /^(Subscribe|Upgrade)$/ })).toHaveCount(0);
        await expect(page.getByText(/^(Trial|Expired|Starter|Pro|Business)( \(Pro\))?$/)).toHaveCount(0);
    });

    test('the badge comes back on their own workspace', async ({ page, context }) => {
        const seed = getSeedResult();

        // Switch to the member's OWN workspace, which is still in trial.
        const { data: own } = await supabaseAdmin
            .from('workspaces')
            .select('id')
            .eq('owner_id', seed.memberId)
            .limit(1)
            .single();

        await context.addCookies([{
            name: 'selectedWorkspaceId',
            value: own!.id,
            url: 'http://127.0.0.1:3000',
        }]);

        await page.goto('/dashboard');
        await page.waitForLoadState('networkidle');

        // Hiding it above must be scoped to the foreign paused workspace, not a
        // blanket removal.
        await expect(page.getByRole('link', { name: /^(Subscribe|Upgrade)$/ })).toHaveCount(1);
    });

    test('a member who never owned a workspace can still create their first one', async ({ page, context }) => {
        const seed = getSeedResult();
        await context.addCookies([{
            name: 'selectedWorkspaceId',
            value: seed.workspaceId,
            url: 'http://127.0.0.1:3000',
        }]);

        await page.goto('/dashboard/workspace-paused');
        await page.waitForLoadState('networkidle');

        await page.getByRole('button', { name: /Current Workspace/i }).click();
        const createItem = page.getByRole('menuitem', { name: /Create Workspace/i });
        await expect(createItem).toBeVisible({ timeout: 10_000 });

        // The seeded member owns an auto-created workspace of their own that is
        // still in trial, so Create Workspace must stay open — locking it on the
        // ACTIVE workspace's state would remove the escape hatch from a
        // workspace someone else stopped paying for.
        await expect(createItem).not.toHaveAttribute('title', /subscribe/i);
    });
});
