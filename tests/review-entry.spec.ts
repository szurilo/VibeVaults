/**
 * Hosted review entry page (`/review/<token>`) — server-backed E2E.
 *
 * This page is the shareable review link now: it must render the guest gate
 * for a healthy project, redeem name + email into a widget identity, and
 * redirect onto the customer's site with `vv_token` + `vv_key` planted. Its
 * failure pages are product surface too — a guest on a bad link must learn
 * what to do, never see a dead URL.
 *
 * The gate is deliberately a plain form POST to /api/review/redeem with no
 * client-side submit handler: guests arrive on unknown devices, and a click
 * landing before hydration would native-submit and silently reload the page
 * (this actually happened on WebKit). The last test pins that guarantee by
 * disabling JavaScript entirely.
 *
 * State care: the seeded project's `widget_last_seen_at` is mutated here, so
 * it is saved in beforeAll and restored in afterAll (zero-retry policy: state
 * pollution breaks later suites). Minted guest identities are cleaned up.
 */
import { test, expect, type Page } from '@playwright/test';
import { getSeedResult } from './utils/seed-result';
import { supabaseAdmin } from './utils/supabase-admin';
import { AUTH_FILES } from './fixtures/test-data';

const GUEST_EMAIL = 'review-entry-e2e@example.com';
const NOJS_GUEST_EMAIL = 'review-entry-nojs-e2e@example.com';

/** Keeps the customer-site redirect target offline. */
async function stubSite(page: Page, siteOrigin: string) {
    await page.route(`${siteOrigin}/**`, (route) =>
        route.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>site</body></html>' }));
}

test.describe('hosted review entry page', () => {
    test.use({ storageState: AUTH_FILES.empty });

    let reviewToken: string;
    let websiteUrl: string;
    let savedLastSeen: string | null;

    test.beforeAll(async () => {
        const seed = getSeedResult();
        const { data: project } = await supabaseAdmin
            .from('projects')
            .select('review_token, website_url, widget_last_seen_at')
            .eq('id', seed.projectId)
            .single();
        reviewToken = project!.review_token;
        websiteUrl = project!.website_url;
        savedLastSeen = project!.widget_last_seen_at;
    });

    test.afterAll(async () => {
        const seed = getSeedResult();
        await supabaseAdmin
            .from('projects')
            .update({ widget_last_seen_at: savedLastSeen })
            .eq('id', seed.projectId);
        await supabaseAdmin
            .from('widget_identities')
            .delete()
            .eq('email', GUEST_EMAIL);
    });

    test('an invalid token shows the invalid-link notice', async ({ page }) => {
        await page.goto('/review/00000000-0000-4000-8000-000000000000');
        await expect(page.getByText("This review link isn't valid")).toBeVisible();
    });

    test('a project whose widget was never seen shows the not-set-up notice', async ({ page }) => {
        const seed = getSeedResult();
        await supabaseAdmin
            .from('projects')
            .update({ widget_last_seen_at: null })
            .eq('id', seed.projectId);

        await page.goto(`/review/${reviewToken}`);
        await expect(page.getByText("This site isn't set up for review yet")).toBeVisible();
    });

    test('a healthy project gates on name + email, then redirects with vv_token and vv_key', async ({ page }) => {
        const seed = getSeedResult();
        await supabaseAdmin
            .from('projects')
            .update({ widget_last_seen_at: new Date().toISOString() })
            .eq('id', seed.projectId);

        // The redirect target is the seeded project's external website URL.
        // Capture the outgoing navigation request instead of waiting for the
        // cross-origin page to "load" — the URL is what the test is about.
        const siteOrigin = new URL(websiteUrl).origin;
        await stubSite(page, siteOrigin);

        await page.goto(`/review/${reviewToken}`);
        await expect(page.getByRole('heading', { name: /^Review / })).toBeVisible();

        await page.locator('#reviewer-name').fill('E2E Guest');
        await page.locator('#reviewer-email').fill(GUEST_EMAIL);

        // The 303 target is captured from the request event: route handlers do
        // not fire for the target of a redirect the browser follows itself.
        const siteRequest = page.waitForRequest((r) => r.url().startsWith(siteOrigin), { timeout: 15_000 });
        await page.getByRole('button', { name: 'Start reviewing' }).click();
        const landed = new URL((await siteRequest).url());
        expect(landed.searchParams.get('vv_key')).toBe(seed.apiKey);
        const rawToken = landed.searchParams.get('vv_token');
        expect(rawToken).toBeTruthy();

        // The minted identity is a real guest row for the seeded project.
        const { data: identity } = await supabaseAdmin
            .from('widget_identities')
            .select('project_id, via_review, display_name')
            .eq('email', GUEST_EMAIL)
            .single();
        expect(identity).toMatchObject({
            project_id: seed.projectId,
            via_review: true,
            display_name: 'E2E Guest',
        });
    });

    test('an invalid submission comes back to the gate with an inline error', async ({ page }) => {
        const seed = getSeedResult();
        await supabaseAdmin
            .from('projects')
            .update({ widget_last_seen_at: new Date().toISOString() })
            .eq('id', seed.projectId);

        await page.goto(`/review/${reviewToken}`);
        // Bypass the browser's own required-field UI to exercise the server path.
        await page.locator('form').evaluate((f: HTMLFormElement) => f.noValidate = true);
        await page.locator('#reviewer-name').fill('No Email Guest');
        await page.getByRole('button', { name: 'Start reviewing' }).click();

        await expect(page.getByText('Please enter your name and a valid email address.')).toBeVisible();
    });
});

// The gate must not depend on client-side JavaScript: a guest clicking before
// hydration used to native-submit and silently reload the page.
test.describe('hosted review entry page without JavaScript', () => {
    test.use({ storageState: AUTH_FILES.empty, javaScriptEnabled: false });

    test('redeems and redirects with JavaScript disabled', async ({ page }) => {
        const seed = getSeedResult();
        const { data: project } = await supabaseAdmin
            .from('projects')
            .select('review_token, website_url, widget_last_seen_at')
            .eq('id', seed.projectId)
            .single();
        const savedLastSeen = project!.widget_last_seen_at;

        await supabaseAdmin
            .from('projects')
            .update({ widget_last_seen_at: new Date().toISOString() })
            .eq('id', seed.projectId);

        const siteOrigin = new URL(project!.website_url).origin;
        await stubSite(page, siteOrigin);

        await page.goto(`/review/${project!.review_token}`);
        await page.locator('#reviewer-name').fill('No JS Guest');
        await page.locator('#reviewer-email').fill(NOJS_GUEST_EMAIL);

        const siteRequest = page.waitForRequest((r) => r.url().startsWith(siteOrigin), { timeout: 15_000 });
        await page.getByRole('button', { name: 'Start reviewing' }).click();
        expect(new URL((await siteRequest).url()).searchParams.get('vv_token')).toBeTruthy();

        await supabaseAdmin.from('widget_identities').delete().eq('email', NOJS_GUEST_EMAIL);
        await supabaseAdmin
            .from('projects')
            .update({ widget_last_seen_at: savedLastSeen })
            .eq('id', seed.projectId);
    });
});
