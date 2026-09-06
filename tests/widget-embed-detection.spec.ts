/**
 * Embed detection: `projects.widget_last_seen_at`.
 *
 * This flag decides two visible things — whether the post-create dialog can
 * offer "Activate widget", and whether the Shareable Review Link card appears
 * at all. It is stamped by an unauthenticated heartbeat from `widget.js`,
 * and that detail is load-bearing: the config GET also stamps it, but only
 * after a token authenticates, so on its own it could never observe a freshly
 * pasted snippet — which is the exact moment the dashboard needs to detect.
 *
 * State care: mutates the seeded project's widget_last_seen_at, restored in
 * afterAll.
 */
import { test, expect } from '@playwright/test';
import { getSeedResult } from './utils/seed-result';
import { supabaseAdmin } from './utils/supabase-admin';
import { AUTH_FILES } from './fixtures/test-data';

test.describe.configure({ mode: 'serial' });

let savedLastSeen: string | null = null;

test.beforeAll(async () => {
    const seed = getSeedResult();
    const { data } = await supabaseAdmin
        .from('projects').select('widget_last_seen_at').eq('id', seed.projectId).single();
    savedLastSeen = data!.widget_last_seen_at;
});

test.afterAll(async () => {
    const seed = getSeedResult();
    await supabaseAdmin
        .from('projects').update({ widget_last_seen_at: savedLastSeen }).eq('id', seed.projectId);
});

test.describe('heartbeat', () => {
    test.use({ storageState: AUTH_FILES.empty });

    test('an unauthenticated heartbeat stamps widget_last_seen_at', async ({ request }) => {
        const seed = getSeedResult();
        await supabaseAdmin
            .from('projects').update({ widget_last_seen_at: null }).eq('id', seed.projectId);

        // No session, no bearer token — exactly how an anonymous page load hits it.
        const res = await request.post(`/api/widget/heartbeat?key=${seed.apiKey}`);
        expect(res.status()).toBe(204);

        const { data } = await supabaseAdmin
            .from('projects').select('widget_last_seen_at').eq('id', seed.projectId).single();
        expect(data!.widget_last_seen_at).not.toBeNull();
    });

    test('a missing key is rejected', async ({ request }) => {
        const res = await request.post('/api/widget/heartbeat');
        expect(res.status()).toBe(400);
    });
});

test.describe('review link card visibility', () => {
    test.use({ storageState: AUTH_FILES.owner });

    test('hidden before the widget is seen, shown after', async ({ page }) => {
        const seed = getSeedResult();

        await supabaseAdmin
            .from('projects').update({ widget_last_seen_at: null }).eq('id', seed.projectId);
        await page.goto('/dashboard/project-settings', { waitUntil: 'domcontentloaded' });
        await expect(page.getByText('Shareable Review Link')).toHaveCount(0);
        // The embed card is always available so the customer can finish setup.
        await expect(page.getByText('Embed widget').first()).toBeVisible();

        await supabaseAdmin
            .from('projects')
            .update({ widget_last_seen_at: new Date().toISOString() })
            .eq('id', seed.projectId);
        await page.goto('/dashboard/project-settings', { waitUntil: 'domcontentloaded' });
        await expect(page.getByText('Shareable Review Link')).toBeVisible();
    });
});

test.describe('post-create dialog polling', () => {
    test.use({ storageState: AUTH_FILES.owner });

    test('flips to "Activate widget" once the widget is seen on the site', async ({ page }) => {
        await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });

        // Create a throwaway project through the real dialog, opened the way a
        // customer does — from the sidebar project switcher.
        const name = `Embed Poll ${Date.now()}`;
        await page.getByRole('button', { name: /current project/i }).click();
        await page.getByText('Create Project').click();
        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();
        await page.locator('#createProjectName').fill(name);
        await page.locator('#createWebsiteUrl').fill('https://embed-poll.example.com');
        await dialog.getByRole('button', { name: /^create$/i }).click();

        await expect(dialog).toContainText(`${name} is ready`);
        await expect(dialog).toContainText('Waiting for the widget');

        // Simulate the site loading widget.js by stamping the flag the same way
        // the heartbeat endpoint does.
        const { data: project } = await supabaseAdmin
            .from('projects').select('id').eq('name', name).single();
        await supabaseAdmin
            .from('projects')
            .update({ widget_last_seen_at: new Date().toISOString() })
            .eq('id', project!.id);

        // The poll runs every 3s; allow a couple of ticks.
        await expect(dialog.getByRole('button', { name: /activate widget/i }))
            .toBeVisible({ timeout: 15_000 });
        await expect(dialog).toContainText('Widget detected');

        await supabaseAdmin.from('projects').delete().eq('id', project!.id);
    });
});
