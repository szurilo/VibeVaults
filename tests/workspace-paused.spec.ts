/**
 * Tier 1 — Revenue-critical: a lapsed owner locks out their whole team.
 *
 * The bug this pins: the paywall used to be derived from the VIEWING user's own
 * subscription, and invited workspaces were explicitly exempted. So when an
 * agency owner's trial ran out, every member they had invited kept full access
 * forever — the account simply stopped paying and carried on working.
 *
 * A workspace is usable only while its OWNER pays. This spec asserts that for
 * all three layers:
 *   1. Routing      — the member is redirected to /dashboard/workspace-paused
 *   2. UI           — the page names who has to renew, and offers a way out
 *   3. Server-side  — the mutation APIs reject the member with 403, so a tab
 *                     opened before the lock (or a direct call) can't write
 *
 * Mutates the owner's billing state; runs serially and restores it in afterAll.
 */

import { test, expect } from '@playwright/test';
import { supabaseAdmin } from './utils/supabase-admin';
import { getSeedResult } from './utils/seed-result';
import { AUTH_FILES } from './fixtures/test-data';

// Must run serially — mutates the shared owner profile
test.describe.configure({ mode: 'serial' });

const yesterday = () => new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
const fourteenDaysFromNow = () => new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

/** Point the member's browser at the owner's workspace so the gate has to decide. */
async function selectOwnerWorkspace(context: import('@playwright/test').BrowserContext) {
    const seed = getSeedResult();
    await context.addCookies([{
        name: 'selectedWorkspaceId',
        value: seed.workspaceId,
        url: 'http://127.0.0.1:3000',
    }]);
}

test.describe('Member lockout when the owner lapses', () => {
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

    // -----------------------------------------------------------------------
    // Routing + UI
    // -----------------------------------------------------------------------
    test.describe('member view', () => {
        test.use({ storageState: AUTH_FILES.member });

        test('lapsed owner → member is redirected off the dashboard', async ({ page, context }) => {
            const seed = getSeedResult();
            await supabaseAdmin
                .from('profiles')
                .update({ trial_ends_at: yesterday(), subscription_status: null, subscription_tier: null })
                .eq('id', seed.ownerId);
            await selectOwnerWorkspace(context);

            await page.goto('/dashboard');
            await page.waitForURL(/\/dashboard\/workspace-paused/, { timeout: 10_000 });
        });

        test('paused page names the owner who must renew', async ({ page, context }) => {
            const seed = getSeedResult();
            await selectOwnerWorkspace(context);

            await page.goto('/dashboard/workspace-paused');
            await page.waitForLoadState('networkidle');

            // The member's single actionable fact: who to chase.
            await expect(page.getByText(seed.ownerEmail, { exact: false })).toBeVisible({ timeout: 10_000 });
            await expect(page.getByRole('heading', { name: /is paused/i })).toBeVisible();

            // Reassurance that nothing was destroyed — this is the question
            // support gets asked first.
            await expect(page.getByText(/nothing has been deleted/i)).toBeVisible();
        });

        test('paused page offers the member their own still-live workspace', async ({ page, context }) => {
            await selectOwnerWorkspace(context);

            await page.goto('/dashboard/workspace-paused');
            await page.waitForLoadState('networkidle');

            // The seeded member owns an auto-created workspace of their own,
            // which is still in trial — so there must be a way out of the dead
            // end rather than just a warning.
            await expect(page.getByRole('heading', { name: /keep working elsewhere/i })).toBeVisible({ timeout: 10_000 });
        });

        test('sidebar is locked on the paused page', async ({ page, context }) => {
            await selectOwnerWorkspace(context);

            await page.goto('/dashboard/workspace-paused');
            await page.waitForLoadState('networkidle');

            // Same lock shape the owner-side paywall uses: dimmed groups carry
            // data-locked, while the exits stay interactive so the user is never
            // trapped — the workspace switcher, and the Users item (the only way
            // a member can leave a workspace).
            const lockedGroup = page.locator('[data-locked="true"]').first();
            await expect(lockedGroup).toBeVisible({ timeout: 10_000 });

            const switcherTrigger = page.getByRole('button', { name: /Current Workspace/i });
            await expect(switcherTrigger).toBeEnabled();

            const usersLink = page.getByRole('link', { name: /^Users$/ });
            await expect(usersLink).toBeVisible();
            await expect(page.locator('[data-locked="true"] a', { hasText: /^Users$/ })).toHaveCount(0);
        });

        test('account page stays reachable while locked out', async ({ page, context }) => {
            await selectOwnerWorkspace(context);

            // Must never be gated: it is where a locked-out user manages or
            // deletes their account. Gating it would trap them.
            await page.goto('/dashboard/account');
            await page.waitForLoadState('networkidle');
            expect(page.url()).toContain('/dashboard/account');
        });

        test('owner renews → member walks straight back in', async ({ page, context }) => {
            const seed = getSeedResult();
            await supabaseAdmin
                .from('profiles')
                .update({ subscription_status: 'active', subscription_tier: 'pro' })
                .eq('id', seed.ownerId);
            await selectOwnerWorkspace(context);

            await page.goto('/dashboard');
            await page.waitForLoadState('networkidle');
            expect(page.url()).toContain('/dashboard');
            expect(page.url()).not.toContain('workspace-paused');
        });

        test('a paused page visit with nothing paused bounces to the dashboard', async ({ page, context }) => {
            // Still healthy from the previous test. The page must not show a
            // stale warning to a member whose owner has already renewed.
            await selectOwnerWorkspace(context);

            await page.goto('/dashboard/workspace-paused');
            await page.waitForURL(url => !url.pathname.includes('workspace-paused'), { timeout: 10_000 });
        });
    });

    // -----------------------------------------------------------------------
    // Server-side enforcement — the part a dimmed sidebar can't provide.
    // A dashboard tab opened before the lock landed still holds live JS, and a
    // server action or API route can be called directly.
    // -----------------------------------------------------------------------
    test.describe('server-side enforcement', () => {
        test.use({ storageState: AUTH_FILES.member });

        test.beforeAll(async () => {
            const seed = getSeedResult();
            await supabaseAdmin
                .from('profiles')
                .update({ trial_ends_at: yesterday(), subscription_status: null, subscription_tier: null })
                .eq('id', seed.ownerId);
        });

        test('member cannot create a project in a paused workspace', async ({ request }) => {
            const seed = getSeedResult();
            const response = await request.post('/api/projects', {
                data: {
                    name: 'Should never exist',
                    website_url: 'https://example.com',
                    workspace_id: seed.workspaceId,
                },
            });

            expect(response.status()).toBe(403);
            // Context-aware copy: a member is told to chase the owner, not to
            // upgrade a plan that isn't theirs.
            expect((await response.text()).toLowerCase()).toContain('owner');
        });

        test('member cannot request an upload URL in a paused workspace', async ({ request }) => {
            const seed = getSeedResult();

            // Own fixture rather than relying on seeded feedback — a missing row
            // would otherwise turn this into a silent skip and the guard would
            // go unchecked.
            const { data: feedback, error } = await supabaseAdmin
                .from('feedbacks')
                .insert({
                    project_id: seed.projectId,
                    content: 'Upload gate fixture',
                    type: 'Bug',
                    sender: seed.memberEmail,
                    status: 'open',
                })
                .select('id')
                .single();
            if (error || !feedback) throw new Error(`Fixture feedback insert failed: ${error?.message}`);

            try {
                const response = await request.post('/api/dashboard/upload', {
                    data: {
                        feedbackId: feedback.id,
                        files: [{ name: 'a.png', size: 1024, type: 'image/png' }],
                    },
                });

                // Presigning must fail: the PUT that follows goes straight to
                // Storage and never passes through us again, so letting the
                // presign through would let a locked-out member write anyway.
                expect(response.status()).toBe(403);
                expect((await response.json()).error.toLowerCase()).toContain('owner');

                // The confirm half is gated too — a stale, already-issued
                // presigned URL must not be convertible into a DB record.
                const confirm = await request.post('/api/dashboard/upload/confirm', {
                    data: {
                        projectId: seed.projectId,
                        feedbackId: feedback.id,
                        files: [{ fileId: 'x', path: 'x/a.png', fileName: 'a.png', size: 1024, mimeType: 'image/png' }],
                    },
                });
                expect(confirm.status()).toBe(403);
            } finally {
                await supabaseAdmin.from('feedbacks').delete().eq('id', feedback.id);
            }
        });

        test('the same calls succeed again once the owner renews', async ({ request }) => {
            const seed = getSeedResult();
            await supabaseAdmin
                .from('profiles')
                .update({ trial_ends_at: fourteenDaysFromNow(), subscription_status: null, subscription_tier: null })
                .eq('id', seed.ownerId);

            const response = await request.post('/api/projects', {
                data: {
                    name: `Paused-gate recovery ${Date.now()}`,
                    website_url: 'https://example.com',
                    workspace_id: seed.workspaceId,
                },
            });

            expect(response.status()).toBe(200);

            // Clean up so project-limit assertions elsewhere aren't skewed.
            const created = await response.json();
            if (created?.id) {
                await supabaseAdmin.from('projects').delete().eq('id', created.id);
            }
        });
    });
});
