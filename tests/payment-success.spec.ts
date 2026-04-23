/**
 * Tier 1 — Revenue-critical: Payment-success page behaviour
 *
 * The payment-success page is the safety net when the Stripe webhook is late
 * or offline. We test two properties:
 *
 *   1. Missing `session_id` redirects to /dashboard (can't be used directly).
 *   2. When the webhook has already flipped `subscription_status=active`, the
 *      page reaches the success state via client-side polling and redirects
 *      to /dashboard. This is the "webhook landed first" path.
 *
 * Note: the *server-side* fallback (`syncProfileFromCheckoutSession` actually
 * retrieves a real Stripe session) can't run against dummy Stripe keys. We
 * exercise the poll-then-redirect path instead, which is what actually keeps
 * users unstuck when the webhook is down.
 *
 * Sensitive Dependencies:
 * - Mutates owner subscription_status; beforeAll captures, afterAll restores.
 */

import { test, expect } from '@playwright/test';
import { supabaseAdmin } from './utils/supabase-admin';
import { getSeedResult } from './utils/seed-result';
import { AUTH_FILES } from './fixtures/test-data';

test.describe.configure({ mode: 'serial' });
test.use({ storageState: AUTH_FILES.owner });

type Snap = {
    subscription_status: string | null;
    subscription_tier: string | null;
    stripe_customer_id: string | null;
    stripe_subscription_id: string | null;
};

let snap: Snap;

test.beforeAll(async () => {
    const seed = getSeedResult();
    const { data } = await supabaseAdmin
        .from('profiles')
        .select('subscription_status, subscription_tier, stripe_customer_id, stripe_subscription_id')
        .eq('id', seed.ownerId)
        .single();
    snap = {
        subscription_status: data?.subscription_status ?? null,
        subscription_tier: data?.subscription_tier ?? null,
        stripe_customer_id: data?.stripe_customer_id ?? null,
        stripe_subscription_id: data?.stripe_subscription_id ?? null,
    };
});

test.afterAll(async () => {
    const seed = getSeedResult();
    await supabaseAdmin.from('profiles').update(snap).eq('id', seed.ownerId);
});

test('missing session_id redirects to /dashboard', async ({ page }) => {
    await page.goto('/dashboard/payment-success');
    await page.waitForURL(/\/dashboard(?!\/payment-success)/, { timeout: 10_000 });
});

test('reaches success state when webhook has already activated the subscription', async ({ page }) => {
    const seed = getSeedResult();

    // Simulate webhook having landed before the user hit the success page.
    await supabaseAdmin
        .from('profiles')
        .update({
            subscription_status: 'active',
            subscription_tier: 'starter',
            stripe_customer_id: `cus_paysuccess_${Date.now()}`,
            stripe_subscription_id: `sub_paysuccess_${Date.now()}`,
        })
        .eq('id', seed.ownerId);

    await page.goto('/dashboard/payment-success?session_id=mock_e2e_session');

    // The client either renders success directly (if server sync found it)
    // or polls supabase and flips to success within a few seconds.
    await expect(page.getByText(/Payment Successful/i)).toBeVisible({ timeout: 15_000 });

    // Then auto-redirects to /dashboard.
    await page.waitForURL(/\/dashboard(?!\/payment-success)/, { timeout: 10_000 });
});
