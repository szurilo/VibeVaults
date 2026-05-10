/**
 * Tier 2 — `issueSelfWidgetLink` server action via the dashboard UI
 *
 * The "Open widget on site" button in `EmbedWidgetCard` is the owner / member
 * path for activating the widget on a host site without going through email.
 * The button:
 *   1. Synchronously opens a blank tab (so popup blockers don't kill it).
 *   2. Calls `issueSelfWidgetLink(project.id)` server action.
 *   3. On success, navigates the new tab to `${website_url}?vv_token=...`.
 *
 * This spec exercises the UI happy path and the `no_website_url` graceful
 * degradation. The unauthenticated / non-member negative cases are defense-
 * in-depth on the server action; they aren't reachable from the UI.
 *
 * Sensitive Dependencies:
 * - Uses the seeded owner session. Cleans up any minted widget_identities
 *   rows after each happy-path click so the table doesn't drift.
 */

import { test, expect } from '@playwright/test';
import { supabaseAdmin } from './utils/supabase-admin';
import { getSeedResult } from './utils/seed-result';
import { AUTH_FILES } from './fixtures/test-data';

test.describe.configure({ mode: 'serial' });

// UI is a thin wrapper around the server action — no per-browser variation
// worth running 3×. The website_url-toggle test also mutates a seed column,
// so cross-browser execution would race on it.
test.skip(({ browserName }) => browserName !== 'chromium', 'Server-action UI wrapper — single-browser run');

// ---------------------------------------------------------------------------
// Owner-side happy path
// ---------------------------------------------------------------------------

test.describe('Open widget on site button (owner)', () => {
    test.use({ storageState: AUTH_FILES.owner });

    test('clicking opens a new tab with ?vv_token=... and the token authenticates widget config', async ({ page, context, request }) => {
        const seed = getSeedResult();

        // The seed's website_url points at an example.com-style host that
        // doesn't resolve in CI. Intercept ANY navigation that carries the
        // vv_token query param and reply with a tiny synthetic body so the
        // navigation actually commits. We narrow the predicate so the
        // dashboard page itself is not affected.
        await context.route(
            url => url.searchParams.has('vv_token'),
            route => route.fulfill({ status: 200, contentType: 'text/html', body: '<html></html>' })
        );

        await page.goto('/dashboard/project-settings');
        await page.waitForLoadState('domcontentloaded');

        const button = page.getByRole('button', { name: /open widget on site/i });
        await expect(button).toBeVisible({ timeout: 10_000 });

        // Click + capture the new tab.
        const [newTab] = await Promise.all([
            context.waitForEvent('page', { timeout: 10_000 }),
            button.click(),
        ]);

        // The tab opens about:blank synchronously, then navigates after the
        // server action resolves. With the route handler above, the navigation
        // commits cleanly and waitForURL resolves quickly.
        await newTab.waitForURL(/vv_token=/, { timeout: 10_000 });

        const url = new URL(newTab.url());
        const token = url.searchParams.get('vv_token');
        expect(token, 'tab URL must carry the freshly-issued token').toBeTruthy();

        // Token must immediately authenticate against the widget config endpoint.
        const configRes = await request.get(`/api/widget?key=${seed.apiKey}`, {
            headers: { Authorization: `Bearer ${token!}` },
        });
        expect(configRes.status(), 'self-issued token must be live for the API immediately').toBe(200);

        // Cleanup the row.
        const crypto = await import('crypto');
        const hash = crypto.createHash('sha256').update(token!).digest('hex');
        await supabaseAdmin.from('widget_identities').delete().eq('token_hash', hash);

        await newTab.close();
    });
});

// ---------------------------------------------------------------------------
// Project without website_url — button must be disabled with a clear hint
// ---------------------------------------------------------------------------

test.describe('Open widget on site button — no website_url', () => {
    test.use({ storageState: AUTH_FILES.owner });

    test('button is disabled and explains why when the project has no website_url', async ({ page, context }) => {
        const seed = getSeedResult();

        // Clone the seed project's website_url so we can null it for the test.
        const { data: original } = await supabaseAdmin
            .from('projects')
            .select('website_url')
            .eq('id', seed.projectId)
            .single();

        try {
            await supabaseAdmin
                .from('projects')
                .update({ website_url: null })
                .eq('id', seed.projectId);

            const dashboardCtx = await context.newPage();
            await dashboardCtx.goto('/dashboard/project-settings');
            // Don't waitForLoadState('networkidle') — the EmbedWidgetCard fires
            // background analytics that may keep the network busy past timeout.
            await dashboardCtx.waitForLoadState('domcontentloaded');

            const button = dashboardCtx.getByRole('button', { name: /open widget on site/i });
            await expect(button).toBeVisible({ timeout: 10_000 });
            await expect(button).toBeDisabled();
            await expect(dashboardCtx.getByText(/add a website url/i)).toBeVisible();

            await dashboardCtx.close();
        } finally {
            // Restore — every other test depends on website_url being set.
            await supabaseAdmin
                .from('projects')
                .update({ website_url: original?.website_url ?? null })
                .eq('id', seed.projectId);
        }
    });
});
