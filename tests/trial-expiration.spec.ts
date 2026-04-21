/**
 * Tier 1 — Revenue-critical: Trial expiration lockout
 *
 * Tests that when a user's trial expires (and they have no subscription):
 *   1. Subscribe page shows "Your trial has expired"
 *   2. Sidebar is locked/dimmed on subscribe page
 *   3. Widget returns 403 (inactive) for the expired owner's project
 *
 * Modifies the owner's trial_ends_at in the DB, then restores it after.
 * Runs serially and restores state in afterAll to avoid affecting other tests.
 */

import { test, expect } from '@playwright/test';
import { supabaseAdmin } from './utils/supabase-admin';
import { getSeedResult } from './utils/seed-result';

// Must run serially — mutates shared owner profile
test.describe.configure({ mode: 'serial' });

test.describe('Trial expiration lockout', () => {
    let originalTrialEndsAt: string | null = null;

    test.beforeAll(async () => {
        const seed = getSeedResult();

        // Save original trial_ends_at so we can restore it
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('trial_ends_at')
            .eq('id', seed.ownerId)
            .single();

        originalTrialEndsAt = profile?.trial_ends_at ?? null;

        // Expire the trial by setting it to yesterday
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        await supabaseAdmin
            .from('profiles')
            .update({ trial_ends_at: yesterday })
            .eq('id', seed.ownerId);
    });

    test.afterAll(async () => {
        const seed = getSeedResult();

        // Restore the original trial_ends_at
        await supabaseAdmin
            .from('profiles')
            .update({ trial_ends_at: originalTrialEndsAt })
            .eq('id', seed.ownerId);
    });

    test('subscribe page shows trial expired messaging', async ({ page }) => {
        // Go directly to subscribe page (expired trial should show urgency messaging)
        await page.goto('/dashboard/subscribe');
        await page.waitForLoadState('networkidle');

        await expect(page.getByRole('heading', { name: /trial has expired/i })).toBeVisible({ timeout: 10_000 });
        await expect(
            page.getByText(/14-day free trial has ended/i)
        ).toBeVisible();
    });

    test('sidebar sub-groups are locked but workspace switcher stays clickable', async ({ page }) => {
        await page.goto('/dashboard/subscribe');
        await page.waitForLoadState('networkidle');

        // The Users/Settings menu group is wrapped in a SidebarMenu that carries
        // the lock classes when the active workspace is owned + expired.
        const usersLink = page.getByRole('link', { name: /^Users$/ });
        await expect(usersLink).toBeVisible();
        const lockedMenu = usersLink.locator('xpath=ancestor::ul[@data-sidebar="menu"][1]');
        await expect(lockedMenu).toHaveClass(/pointer-events-none/);
        await expect(lockedMenu).toHaveClass(/opacity-50/);

        // The workspace switcher must stay interactive so an expired owner can
        // navigate to an invited workspace. Its trigger should not inherit any
        // lock styling.
        const switcherTrigger = page.getByRole('button', { name: /Current Workspace/i });
        await expect(switcherTrigger).toBeVisible();
        await expect(switcherTrigger).toBeEnabled();
    });

    test('widget API returns 403 for expired trial owner', async ({ page }) => {
        const seed = getSeedResult();

        // Directly test the widget config endpoint
        const response = await page.request.get(
            `http://127.0.0.1:3000/api/widget?key=${seed.apiKey}`
        );

        expect(response.status()).toBe(403);
        const body = await response.json();
        expect(body.error).toContain('inactive');
    });
});
