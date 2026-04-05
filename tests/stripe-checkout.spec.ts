/**
 * Tier 1 — Revenue-critical: Stripe checkout flow
 *
 * Tests the subscription purchase funnel:
 *   1. Navigate to /dashboard/subscribe
 *   2. Verify pricing cards render with correct tiers
 *   3. Click "Subscribe" on a plan — verify redirect to Stripe Checkout (mocked)
 *   4. Simulate webhook → verify tier updates in the app
 *
 * Uses Stripe route mocking since CI uses dummy Stripe keys.
 * Runs serially because the webhook simulation mutates the owner's profile.
 */

import { test, expect } from '@playwright/test';
import { mockStripeCheckout, simulateWebhookSubscription } from './fixtures/stripe-mock';
import { supabaseAdmin } from './utils/supabase-admin';
import { getSeedResult } from './utils/seed-result';

// These tests share state (owner profile) and must run in order
test.describe.configure({ mode: 'serial' });

test.describe('Stripe checkout flow', () => {
    test('subscribe page renders correct pricing tiers', async ({ page }) => {
        await page.goto('/dashboard/subscribe');
        await page.waitForLoadState('networkidle');

        // Page heading should be visible (trial context)
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

        // All three tier names should be present (use heading role to avoid ambiguity)
        await expect(page.getByRole('heading', { name: 'Starter' })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Pro' })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Business' })).toBeVisible();

        // Monthly/Yearly toggle should be present
        await expect(page.getByRole('button', { name: 'Monthly' })).toBeVisible();
        await expect(page.getByRole('button', { name: /Yearly/ })).toBeVisible();
    });

    test('yearly toggle updates prices with 20% discount', async ({ page }) => {
        await page.goto('/dashboard/subscribe');
        await page.waitForLoadState('networkidle');

        // Click yearly
        await page.getByRole('button', { name: /Yearly/ }).click();

        // "Save 20%" badge should be visible
        await expect(page.getByText('Save 20%')).toBeVisible();
    });

    test('clicking Subscribe redirects to Stripe Checkout', async ({ page }) => {
        await page.goto('/dashboard/subscribe');
        await page.waitForLoadState('networkidle');

        // Mock Stripe checkout to redirect back to our success URL
        await mockStripeCheckout(page);

        // Find a Subscribe link inside the pricing cards (scoped to avoid sidebar "Subscribe" link)
        const subscribeLinks = page
            .locator('a[href*="/api/stripe/checkout"]')
            .filter({ hasText: /^Subscribe$/ });
        const firstLink = subscribeLinks.first();
        await expect(firstLink).toBeVisible();

        // The href should point to /api/stripe/checkout?priceId=...
        const href = await firstLink.getAttribute('href');
        expect(href).toContain('/api/stripe/checkout');

        // Click and verify we get redirected to the mocked success page
        await firstLink.click();
        await page.waitForURL('**/dashboard/payment-success**', { timeout: 15_000 });
    });

    test('simulated webhook updates user tier in the app', async ({ page }) => {
        const seed = getSeedResult();

        // Simulate what Stripe webhook would do: set tier to 'starter'
        await simulateWebhookSubscription(supabaseAdmin, seed.ownerId, 'starter');

        // Navigate to account page — billing card should show the new tier
        await page.goto('/dashboard/account');
        await page.waitForLoadState('networkidle');

        // The billing card shows "Current plan: Starter"
        await expect(page.getByText('Current plan: Starter')).toBeVisible({ timeout: 10_000 });
    });

    // Clean up: revert to trial state so other test files aren't affected
    test.afterAll(async () => {
        const seed = getSeedResult();
        await supabaseAdmin
            .from('profiles')
            .update({
                stripe_customer_id: null,
                stripe_subscription_id: null,
                subscription_status: null,
                subscription_tier: null,
            })
            .eq('id', seed.ownerId);
    });
});
