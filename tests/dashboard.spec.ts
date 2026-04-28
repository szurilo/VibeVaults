import { test, expect, Page } from '@playwright/test';
import { generateMagicLink } from './utils/supabase-admin';
import { AUTH_FILES } from './fixtures/test-data';

// ---------------------------------------------------------------------------
// Onboarding helper — only used by the fresh-user onboarding test.
// Creates a brand-new user so the onboarding card is guaranteed to show.
// ---------------------------------------------------------------------------
async function signInFreshUser(page: Page): Promise<void> {
    const testEmail = `e2e-onboard-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
    const magicLink = await generateMagicLink(testEmail);
    await page.goto(magicLink);
    await page.waitForURL('**/dashboard**');
}

// ---------------------------------------------------------------------------
// Onboarding flow — requires a completely unauthenticated fresh user.
// Overrides the project-level storageState to start with no session.
// ---------------------------------------------------------------------------
test.describe('Onboarding flow', () => {
    test.use({ storageState: AUTH_FILES.empty });

    test('new user completes onboarding and reaches dashboard', async ({ page }) => {
        await signInFreshUser(page);

        // Onboarding card must appear
        await expect(page.locator('text=Getting Started 🚀')).toBeVisible();

        // Open "Create a project" dialog via the clickable step label
        await page.getByRole('button', { name: /Create a project/i }).click();

        // Fill and submit the dialog
        await expect(page.getByRole('dialog')).toBeVisible();
        await page.locator('#createProjectName').fill('My Test Project');
        await page.locator('#createWebsiteUrl').fill('https://example.com');
        await page.getByRole('dialog').getByRole('button', { name: /^create$/i }).click();

        await expect(page.getByRole('dialog')).toBeHidden();

        // Dismiss onboarding
        await expect(page.getByText("I'll explore on my own")).toBeVisible();
        await page.getByText("I'll explore on my own").click();

        // Dashboard renders with the new project
        await expect(page.locator('h1')).toContainText('Overview');
        await expect(page.locator('h1')).toContainText('My Test Project');
        await expect(page.locator('text=Total Feedback')).toBeVisible();
        await expect(page.locator('text=Questions or Problems?')).toBeVisible();
    });
});

// ---------------------------------------------------------------------------
// Pre-authenticated tests — use the storageState created by globalSetup.
// These tests skip the onboarding/auth steps and run significantly faster.
// ---------------------------------------------------------------------------
test.describe('Dashboard pages — authenticated user', () => {

    test('overview page renders correctly', async ({ page }) => {
        await page.goto('/dashboard');

        await expect(page.locator('h1')).toContainText('Overview');
        await expect(page.locator('text=Total Feedback')).toBeVisible();
        await expect(page.locator('text=Questions or Problems?')).toBeVisible();
    });

    test('project settings page renders correctly', async ({ page }) => {
        await page.goto('/dashboard/project-settings', { waitUntil: 'domcontentloaded' });

        await expect(page.locator('h1')).toContainText('Project Settings');
        await expect(page.locator('text=Project Name')).toBeVisible();
        await expect(page.locator('text=Embed widget').first()).toBeVisible();
    });

    test('users page renders correctly', async ({ page }) => {
        await page.goto('/dashboard/settings/users', { waitUntil: 'domcontentloaded' });

        await expect(page.locator('h1')).toContainText('Users');
        await expect(page.getByRole('button', { name: /invite/i })).toBeVisible();
    });
});
