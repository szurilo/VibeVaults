/**
 * Tier 1 — Revenue-critical: Auth round-trip
 *
 * Tests the complete authentication lifecycle:
 *   1. Register a fresh user via magic link
 *   2. Verify they land on the dashboard
 *   3. Sign out
 *   4. Sign back in via magic link
 *   5. Verify dashboard loads again
 */

import { test, expect, Page } from '@playwright/test';
import { generateMagicLink } from './utils/supabase-admin';
import { AUTH_FILES } from './fixtures/test-data';

// This test creates its own user — start with no session.
test.use({ storageState: AUTH_FILES.empty });

const freshEmail = `e2e-auth-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;

async function authenticateViaMagicLink(page: Page, email: string): Promise<void> {
    const magicLink = await generateMagicLink(email);
    await page.goto(magicLink);
    // Confirm page shows "Verified!" then redirects
    await expect(page.getByText('Verified!')).toBeVisible({ timeout: 15_000 });
    await page.waitForURL('**/dashboard**', { timeout: 30_000 });
}

test.describe('Auth round-trip', () => {
    test('register → dashboard → sign out → sign in → dashboard', async ({ page }) => {
        // ── Step 1: Register (first magic link creates the user) ──
        await authenticateViaMagicLink(page, freshEmail);

        // Dashboard should show the onboarding card for a fresh user
        await expect(page.getByText('Getting Started')).toBeVisible({ timeout: 15_000 });

        // ── Step 2: Sign out ──
        // The Sign Out button is inside a DropdownMenu in the sidebar footer.
        // Open the dropdown by clicking the user menu trigger (button containing the email).
        const footer = page.locator('[data-sidebar="footer"]');
        await footer.getByRole('button').filter({ hasText: freshEmail }).first().click();

        // Dropdown menu renders in a portal — wait for the menu item, then click it.
        const signOutItem = page.getByRole('menuitem', { name: /sign out/i });
        await expect(signOutItem).toBeVisible({ timeout: 5_000 });
        await signOutItem.click();
        await page.waitForURL('**/auth/login**', { timeout: 15_000 });

        // Verify we're on the login page
        await expect(page.getByText('Welcome Back')).toBeVisible();

        // ── Step 3: Sign back in ──
        await authenticateViaMagicLink(page, freshEmail);

        // Dashboard loads — onboarding card should still be visible (hasn't been completed)
        await expect(page.getByText('Getting Started')).toBeVisible({ timeout: 15_000 });
    });
});
