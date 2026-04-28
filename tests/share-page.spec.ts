/**
 * Tier 1 — Public surface: Share page visibility
 *
 * The `/share/[token]` page is the only public window into a project. The
 * 404 rules below are security-critical: a regression could leak another
 * tenant's feedback to anonymous visitors.
 *
 * Matrix:
 *   is_sharing_enabled = false                         → 404
 *   is_sharing_enabled = true, unknown token           → 404
 *   is_sharing_enabled = true, owner on Starter tier   → 404 (tier gate)
 *   is_sharing_enabled = true, owner on Pro tier       → 200, shows project name
 *
 * Sensitive Dependencies:
 * - Mutates project sharing flags and owner tier. beforeAll captures and
 *   afterAll restores both so downstream specs stay consistent.
 */

import { test, expect } from '@playwright/test';
import { supabaseAdmin } from './utils/supabase-admin';
import { getSeedResult } from './utils/seed-result';
import { TEST_PROJECT, AUTH_FILES } from './fixtures/test-data';
import { randomUUID } from 'node:crypto';

// Mutates shared state — serial.
test.describe.configure({ mode: 'serial' });

// Public page — no auth cookies at all.
test.use({ storageState: AUTH_FILES.empty });

type Snap = {
    profile: {
        subscription_tier: string | null;
        subscription_status: string | null;
        trial_ends_at: string | null;
    };
    project: {
        is_sharing_enabled: boolean | null;
        share_token: string | null;
    };
};

let snap: Snap;
let shareToken: string;

test.beforeAll(async () => {
    const seed = getSeedResult();

    const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('subscription_tier, subscription_status, trial_ends_at')
        .eq('id', seed.ownerId)
        .single();
    const { data: project } = await supabaseAdmin
        .from('projects')
        .select('is_sharing_enabled, share_token')
        .eq('id', seed.projectId)
        .single();

    snap = {
        profile: {
            subscription_tier: profile?.subscription_tier ?? null,
            subscription_status: profile?.subscription_status ?? null,
            trial_ends_at: profile?.trial_ends_at ?? null,
        },
        project: {
            is_sharing_enabled: project?.is_sharing_enabled ?? null,
            share_token: project?.share_token ?? null,
        },
    };

    // Ensure the project has a share_token we can use across tests.
    shareToken = snap.project.share_token ?? randomUUID();
    if (!snap.project.share_token) {
        await supabaseAdmin
            .from('projects')
            .update({ share_token: shareToken })
            .eq('id', seed.projectId);
    }
});

test.afterAll(async () => {
    const seed = getSeedResult();
    await supabaseAdmin
        .from('profiles')
        .update(snap.profile)
        .eq('id', seed.ownerId);
    await supabaseAdmin
        .from('projects')
        .update(snap.project)
        .eq('id', seed.projectId);
});

async function setOwnerTier(ownerId: string, tier: 'starter' | 'pro') {
    await supabaseAdmin
        .from('profiles')
        .update({
            subscription_tier: tier,
            subscription_status: 'active',
            trial_ends_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        })
        .eq('id', ownerId);
}

async function setSharing(projectId: string, enabled: boolean) {
    await supabaseAdmin
        .from('projects')
        .update({ is_sharing_enabled: enabled })
        .eq('id', projectId);
}

test('sharing disabled → 404 copy', async ({ page }) => {
    const seed = getSeedResult();
    await setOwnerTier(seed.ownerId, 'pro');
    await setSharing(seed.projectId, false);

    await page.goto(`/share/${shareToken}`);
    await expect(page.getByRole('heading', { name: '404', level: 1 })).toBeVisible();
    await expect(page.getByText(/sharing is disabled/i)).toBeVisible();
});

test('unknown token → 404 copy (no existence leak)', async ({ page }) => {
    // Even with a valid, otherwise-shareable project in the DB, a wrong token
    // must render the same 404 — no distinguishing "token invalid" message.
    const seed = getSeedResult();
    await setOwnerTier(seed.ownerId, 'pro');
    await setSharing(seed.projectId, true);

    await page.goto(`/share/${randomUUID()}`);
    await expect(page.getByRole('heading', { name: '404', level: 1 })).toBeVisible();
});

test('Starter tier with sharing enabled still 404s (tier gate)', async ({ page }) => {
    const seed = getSeedResult();
    await setOwnerTier(seed.ownerId, 'starter');
    await setSharing(seed.projectId, true);

    await page.goto(`/share/${shareToken}`);
    // Starter's `publicDashboard: false` must block access even if the owner
    // flipped the flag before a downgrade landed.
    await expect(page.getByRole('heading', { name: '404', level: 1 })).toBeVisible();
});

test('cancelled owner (status=inactive, tier=null) → 404 even if sharing was left on', async ({ page }) => {
    // Regression guard: `enforceTierLimitsOnChange(null, ...)` used to resolve
    // limits to Pro (via getTierLimits(null)), leaving `is_sharing_enabled`
    // rows intact on cancellation. The share page now also gates on
    // hasActiveAccess, so stale rows stop serving immediately.
    const seed = getSeedResult();
    await supabaseAdmin
        .from('profiles')
        .update({
            subscription_tier: null,
            subscription_status: 'inactive',
            trial_ends_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        })
        .eq('id', seed.ownerId);
    await setSharing(seed.projectId, true);

    await page.goto(`/share/${shareToken}`);
    await expect(page.getByRole('heading', { name: '404', level: 1 })).toBeVisible();
});

test('Pro tier with sharing enabled → 200 and project name renders', async ({ page }) => {
    const seed = getSeedResult();
    await setOwnerTier(seed.ownerId, 'pro');
    await setSharing(seed.projectId, true);

    const response = await page.goto(`/share/${shareToken}`);
    expect(response?.status(), `got ${response?.status()}`).toBeLessThan(400);

    // Project name should appear in the header (heading level 1).
    await expect(
        page.getByRole('heading', { name: TEST_PROJECT.name, level: 1 })
    ).toBeVisible({ timeout: 10_000 });

    // "Public Board" pill confirms we're in the shared view, not the dashboard.
    await expect(page.getByText('Public Board')).toBeVisible();
});
