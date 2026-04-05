/**
 * Main Responsibility: Playwright route interceptors for Stripe endpoints.
 * Since E2E tests run against local Supabase with dummy Stripe keys,
 * we mock the Stripe redirect at the network level while letting our
 * own API route logic execute up to the Stripe call.
 */

import { Page } from '@playwright/test';

/**
 * Intercepts the GET /api/stripe/checkout redirect.
 *
 * Our checkout route (GET) ends with `NextResponse.redirect(session.url, 303)`.
 * With dummy keys Stripe SDK will throw, so we intercept at the route level
 * and simulate a redirect back to the payment success page.
 *
 * Note: Playwright's `route.fulfill` does not support 3xx status codes,
 * so we return a 200 HTML page that does a client-side redirect instead.
 */
export async function mockStripeCheckout(page: Page): Promise<void> {
    await page.route('**/api/stripe/checkout**', async (route) => {
        const url = new URL(route.request().url());
        const origin = url.origin;
        const successUrl = `${origin}/dashboard/payment-success?session_id=mock_e2e_session`;

        // Return an HTML page that immediately redirects (since fulfill can't do 303)
        await route.fulfill({
            status: 200,
            contentType: 'text/html',
            body: `<html><head><meta http-equiv="refresh" content="0;url=${successUrl}"></head><body>Redirecting...</body></html>`,
        });
    });
}

/**
 * After mocking checkout, call this to directly set the user's subscription
 * in the DB (simulating what the Stripe webhook would do).
 */
export async function simulateWebhookSubscription(
    supabaseAdmin: import('@supabase/supabase-js').SupabaseClient,
    userId: string,
    tier: 'starter' | 'pro' | 'business',
): Promise<void> {
    await supabaseAdmin
        .from('profiles')
        .update({
            stripe_customer_id: `cus_mock_${userId.slice(0, 8)}`,
            stripe_subscription_id: `sub_mock_${userId.slice(0, 8)}`,
            subscription_status: 'active',
            subscription_tier: tier,
        })
        .eq('id', userId);
}
