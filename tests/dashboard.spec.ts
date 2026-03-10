import { test, expect, Page } from '@playwright/test';
import { getMagicLink } from './utils/auth';

// Helper to quickly onboard a new test user to reach the dashboard
async function onboardUser(page: Page) {
    const randomSuffix = Math.floor(Math.random() * 1000000);
    const testEmail = `test-onboard-${Date.now()}-${randomSuffix}@example.com`;
    const magicLink = await getMagicLink(page, testEmail);

    await page.goto(magicLink);

    // Wait for redirect to dashboard
    await page.waitForURL('**/dashboard**');
    await expect(page).toHaveURL(/.*\/dashboard/);

    // The new onboarding shows a checklist card with "Getting Started 🚀"
    await expect(page.locator('text=Getting Started 🚀')).toBeVisible();

    // Click the "Go" button next to "Create a project" to open the CreateProjectDialog
    // Use `has` with a label locator to avoid matching ancestor divs that also start with this text
    const createProjectRow = page.locator('div').filter({ has: page.locator('label', { hasText: 'Create a project' }) }).first();
    await createProjectRow.getByRole('button', { name: /go/i }).click();

    // Fill in the CreateProjectDialog
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.locator('#createProjectName').fill('My Test Project');
    await page.locator('#createWebsiteUrl').fill('https://example.com');
    await page.getByRole('dialog').getByRole('button', { name: /^create$/i }).click();

    // Wait for dialog to close and page to refresh with the new project
    await expect(page.getByRole('dialog')).toBeHidden();

    // Dismiss onboarding by clicking "I'll explore on my own"
    await expect(page.getByText("I'll explore on my own")).toBeVisible();
    await page.getByText("I'll explore on my own").click();
}

test.describe('Dashboard UI & User Management', () => {

    test('should allow a new user to onboard and view the dashboard', async ({ page }) => {
        await onboardUser(page);

        // After finishing onboarding, wait for the actual layout to rerender and show the Project
        // This allows the router.refresh() from completeOnboardingAction to complete.
        await expect(page.locator('h1')).toContainText('Overview');
        await expect(page.locator('h1')).toContainText('My Test Project');

        const totalFeedbackCard = page.locator('text=Total Feedback');
        await expect(totalFeedbackCard).toBeVisible();

        const questionsCard = page.locator('text=Questions or Problems?');
        await expect(questionsCard).toBeVisible();
    });

    test('should allow navigating to Project Settings', async ({ page }) => {
        await onboardUser(page);

        // Navigate to project settings and wait for DOM completely
        await page.goto('/dashboard/project-settings', { waitUntil: 'domcontentloaded' });

        await expect(page.locator('h1')).toContainText('Project Settings');

        // Form fields like Project Name should be visible
        await expect(page.locator('text=Project Name')).toBeVisible();
        await expect(page.locator('text=Embed widget').first()).toBeVisible();
    });

    test('should allow navigating to User Management', async ({ page }) => {
        await onboardUser(page);

        // Navigate to Users
        await page.goto('/dashboard/settings/users', { waitUntil: 'domcontentloaded' });

        await expect(page.locator('h1')).toContainText('Users');

        // Check for specific text or buttons on the users page
        // "Invite User" or "Invite" or "Invite Member", previous instructions say "Users"
        const inviteBtn = page.getByRole('button', { name: /invite/i });
        await expect(inviteBtn).toBeVisible();
    });

});
