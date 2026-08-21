/**
 * Tier 2 — Marketing chrome: auth-aware SiteHeader
 *
 * `SiteHeader` resolves the session server-side and swaps the Sign In / Get
 * Started pair for a Dashboard button. Two failure modes justify a test:
 *
 *   1. Revenue. If the auth read breaks in the "signed in" direction, logged-OUT
 *      visitors lose both conversion CTAs on every marketing page at once, and
 *      nothing else in the product would look wrong.
 *   2. Nagging paying customers to register again, which is the reason the
 *      header became auth-aware in the first place.
 *
 * Also pins the two placement decisions that are easy to undo by accident: the
 * dashboard's only route to the docs, and /access rendering the minimal header
 * (invited clients never get an account, so a Sign In button there sends them
 * into a signup that cannot help them).
 *
 * Signed-in state comes from the default owner storageState in
 * playwright.config.ts; signed-out cases use a fresh context.
 */
import { test, expect, type Page } from '@playwright/test';

/** Pages that render the full marketing header. */
const CHROME_PAGES = ['/', '/pricing', '/docs', '/privacy-policy', '/terms-of-service'];

const header = (page: Page) => page.locator('header').first();

test.describe('signed in', () => {
    for (const path of CHROME_PAGES) {
        test(`${path} shows Dashboard instead of the signup CTAs`, async ({ page }) => {
            await page.goto(path);
            await expect(header(page).getByRole('link', { name: 'Dashboard' })).toBeVisible();
            await expect(header(page).getByRole('link', { name: 'Get Started' })).toHaveCount(0);
            await expect(header(page).getByRole('link', { name: 'Sign In' })).toHaveCount(0);
        });
    }

    test('the swap is server-rendered, so there is no signed-out flash', async ({ page }) => {
        // Assert on the HTML the server sent, before client JS could change it.
        const res = await page.goto('/docs');
        const html = await res!.text();
        const markup = html.slice(0, html.indexOf('</header>'));
        expect(markup).toContain('>Dashboard<');
        expect(markup).not.toContain('>Get Started<');
    });

    test('the dashboard support card links out to the docs', async ({ page }) => {
        await page.goto('/dashboard');
        const link = page.getByRole('link', { name: 'documentation' });
        await expect(link).toBeVisible();
        await expect(link).toHaveAttribute('href', '/docs');
        await expect(link).toHaveAttribute('target', '_blank');
    });
});

test.describe('signed out', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    for (const path of CHROME_PAGES) {
        test(`${path} keeps both conversion CTAs`, async ({ page }) => {
            await page.goto(path);
            await expect(header(page).getByRole('link', { name: 'Get Started' })).toBeVisible();
            await expect(header(page).getByRole('link', { name: 'Sign In' })).toBeVisible();
            await expect(header(page).getByRole('link', { name: 'Dashboard' })).toHaveCount(0);
        });
    }
});

test.describe('/access uses the minimal header', () => {
    // Checked signed-out (a client who lost their token) and signed-in (a member
    // who did), because the point is that neither is offered an account here.
    test('signed out: wordmark only, no CTAs', async ({ browser }) => {
        const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
        const page = await ctx.newPage();
        await page.goto('/access');
        await expect(header(page).getByRole('link', { name: 'VibeVaults' })).toBeVisible();
        await expect(header(page).getByRole('link', { name: 'Sign In' })).toHaveCount(0);
        await expect(header(page).getByRole('link', { name: 'Get Started' })).toHaveCount(0);
        await expect(header(page).getByRole('link', { name: 'Pricing' })).toHaveCount(0);
        await ctx.close();
    });

    test('signed in: still no Dashboard button', async ({ page }) => {
        await page.goto('/access');
        await expect(header(page).getByRole('link', { name: 'Dashboard' })).toHaveCount(0);
        await expect(page.getByRole('heading', { name: 'Lost widget access?' })).toBeVisible();
    });
});
