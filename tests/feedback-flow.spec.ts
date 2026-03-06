import { test, expect } from '@playwright/test';

test.describe('Feedback Widget Flow', () => {
    test('should render widget and allow submitting feedback successfully', async ({ page }) => {
        // Intercept the initial GET request to simulate a valid configuration
        await page.route('**/api/widget?key=*', async (route) => {
            if (route.request().method() === 'GET') {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ project: { name: 'Test Project' }, notifyReplies: true }),
                });
            } else {
                await route.continue();
            }
        });

        // Intercept the POST request for submitting feedback
        await page.route('**/api/widget', async (route) => {
            if (route.request().method() === 'POST') {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ success: true, feedback_id: 'mock-test-id' }),
                });
            } else {
                await route.continue();
            }
        });

        // Intercept the GET feedbacks request
        await page.route('**/api/widget/feedbacks?key=*', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ feedbacks: [] }),
            });
        });

        // Navigate to the app with the vv_email parameter to set client identity for the widget
        await page.goto('/?vv_email=client@example.com');

        // Wait for the widget host (Shadow DOM) to be attached
        const widgetHost = page.locator('#vibe-vaults-widget-host');
        await widgetHost.waitFor({ state: 'attached' });

        // The widget uses Shadow DOM, so we need to access inside it. Playwright penetrates shadow DOM by default!
        // But we can also use specific locators.

        // Look for the trigger button text
        const triggerBtn = widgetHost.locator('.trigger-btn');
        await expect(triggerBtn).toBeVisible();

        // Click to open the widget popup
        await triggerBtn.click();

        // Wait for the popup to be visible
        const popup = widgetHost.locator('.popup');
        await expect(popup).toHaveClass(/open/);

        // Check that we see the "Send Feedback" header
        await expect(widgetHost.locator('.header h3')).toContainText('Send Feedback');

        // Fill the feedback textarea
        const textarea = widgetHost.locator('#vv-textarea');
        await textarea.fill('This is an automated test feedback');

        // Submit feedback
        const submitBtn = widgetHost.locator('#vv-submit');
        await submitBtn.click();

        // Verify the success view
        const successView = widgetHost.locator('#vv-success');
        await expect(successView).toBeVisible();
        await expect(successView).toContainText('Sent!');
    });
});
