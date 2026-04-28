/**
 * Tier 1 — Revenue-critical: Stripe portal + downgrade enforcement
 *
 * Two areas:
 *   1. `/api/stripe/portal` — auth + "no billing account" errors
 *   2. `enforceTierLimitsOnChange` — side effects that MUST fire when a user
 *      downgrades from Pro/Business to Starter (called by the webhook on
 *      customer.subscription.updated/deleted):
 *        - Every `is_sharing_enabled=true` project in the owner's workspaces
 *          gets flipped back to false (Starter lacks publicDashboard).
 *        - Any `email_preferences.email_frequency='realtime'` row for the
 *          owner's email gets flipped back to 'digest' (Starter lacks realtime).
 *
 * These side effects are what keeps downgraded users from keeping paid features.
 * A regression here is direct revenue leakage.
 *
 * Sensitive Dependencies:
 * - Imports `enforceTierLimitsOnChange` directly. The helper uses the admin
 *   client and does not depend on Stripe API calls, so it's safe to drive
 *   from tests without network.
 */

import { test, expect } from '@playwright/test';
import { supabaseAdmin } from './utils/supabase-admin';
import { getSeedResult } from './utils/seed-result';
import { AUTH_FILES } from './fixtures/test-data';
import { enforceTierLimitsOnChange } from '../src/lib/stripe-sync';

test.describe.configure({ mode: 'serial' });

// ---------------------------------------------------------------------------
// Portal endpoint — role and billing-account guards
// ---------------------------------------------------------------------------

test.describe('POST /api/stripe/portal', () => {
    test('unauthenticated request → 401', async ({ browser }) => {
        const ctx = await browser.newContext({ storageState: AUTH_FILES.empty });
        const response = await ctx.request.post('/api/stripe/portal');
        expect(response.status()).toBe(401);
        await ctx.close();
    });

    test('authenticated user without stripe_customer_id → 400', async ({ browser }) => {
        // Seed owner normally has no stripe_customer_id (cleared by stripe-checkout afterAll).
        // Defensively wipe it here so this test is independent of run order.
        const seed = getSeedResult();
        const { data: before } = await supabaseAdmin
            .from('profiles')
            .select('stripe_customer_id')
            .eq('id', seed.ownerId)
            .single();
        const originalCustomer = before?.stripe_customer_id ?? null;

        await supabaseAdmin
            .from('profiles')
            .update({ stripe_customer_id: null })
            .eq('id', seed.ownerId);

        try {
            const ctx = await browser.newContext({ storageState: AUTH_FILES.owner });
            const response = await ctx.request.post('/api/stripe/portal');
            expect(response.status()).toBe(400);
            const body = await response.json();
            expect(body.error).toMatch(/No billing account/i);
            await ctx.close();
        } finally {
            await supabaseAdmin
                .from('profiles')
                .update({ stripe_customer_id: originalCustomer })
                .eq('id', seed.ownerId);
        }
    });
});

// ---------------------------------------------------------------------------
// Downgrade enforcement — the "don't let paying users keep paid features
// after they cancel/downgrade" contract
// ---------------------------------------------------------------------------

test.describe('enforceTierLimitsOnChange on downgrade', () => {
    // Capture pre-test state so we can restore it.
    type ProjectSnap = { id: string; is_sharing_enabled: boolean | null };
    let projectSnaps: ProjectSnap[] = [];
    const mockCustomerId = `cus_e2e_downgrade_${Date.now()}`;
    let profileCustomerSnapshot: string | null = null;
    let emailPrefSnapshot: 'digest' | 'realtime' | null = null;
    let hadEmailPrefRow = false;

    test.beforeAll(async () => {
        const seed = getSeedResult();

        // 1. Link the owner profile to our mock Stripe customer so the helper
        //    can find them by stripe_customer_id.
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('stripe_customer_id')
            .eq('id', seed.ownerId)
            .single();
        profileCustomerSnapshot = profile?.stripe_customer_id ?? null;

        await supabaseAdmin
            .from('profiles')
            .update({ stripe_customer_id: mockCustomerId })
            .eq('id', seed.ownerId);

        // 2. Snapshot + flip every project in the owner's workspace to
        //    sharing-enabled, so the downgrade has something to disable.
        const { data: projects } = await supabaseAdmin
            .from('projects')
            .select('id, is_sharing_enabled')
            .eq('workspace_id', seed.workspaceId);
        projectSnaps = (projects ?? []).map(p => ({
            id: p.id,
            is_sharing_enabled: p.is_sharing_enabled,
        }));
        if (projectSnaps.length) {
            await supabaseAdmin
                .from('projects')
                .update({ is_sharing_enabled: true })
                .in('id', projectSnaps.map(p => p.id));
        }

        // 3. Ensure an email_preferences row exists at 'realtime' for the owner.
        const { data: existingPref } = await supabaseAdmin
            .from('email_preferences')
            .select('email_frequency')
            .eq('email', seed.ownerEmail)
            .maybeSingle();

        if (existingPref) {
            hadEmailPrefRow = true;
            emailPrefSnapshot = (existingPref.email_frequency as 'digest' | 'realtime' | null) ?? null;
            await supabaseAdmin
                .from('email_preferences')
                .update({ email_frequency: 'realtime' })
                .eq('email', seed.ownerEmail);
        } else {
            hadEmailPrefRow = false;
            await supabaseAdmin
                .from('email_preferences')
                .insert({ email: seed.ownerEmail, email_frequency: 'realtime' });
        }
    });

    test.afterAll(async () => {
        const seed = getSeedResult();

        // Restore projects to their original sharing state.
        for (const p of projectSnaps) {
            await supabaseAdmin
                .from('projects')
                .update({ is_sharing_enabled: p.is_sharing_enabled })
                .eq('id', p.id);
        }

        // Restore the profile customer link.
        await supabaseAdmin
            .from('profiles')
            .update({ stripe_customer_id: profileCustomerSnapshot })
            .eq('id', seed.ownerId);

        // Restore email preferences.
        if (hadEmailPrefRow) {
            await supabaseAdmin
                .from('email_preferences')
                .update({ email_frequency: emailPrefSnapshot ?? 'digest' })
                .eq('email', seed.ownerEmail);
        } else {
            await supabaseAdmin
                .from('email_preferences')
                .delete()
                .eq('email', seed.ownerEmail);
        }
    });

    test('downgrade to Starter disables sharing on every project', async () => {
        const seed = getSeedResult();

        await enforceTierLimitsOnChange('starter', mockCustomerId);

        const { data: after } = await supabaseAdmin
            .from('projects')
            .select('id, is_sharing_enabled')
            .eq('workspace_id', seed.workspaceId);

        for (const row of after ?? []) {
            expect(
                row.is_sharing_enabled,
                `project ${row.id} should have sharing disabled`
            ).toBe(false);
        }
    });

    test('downgrade to Starter reverts email_frequency from realtime → digest', async () => {
        const seed = getSeedResult();

        // Re-set realtime (the previous test already called enforce, but this
        // isolates the assertion).
        await supabaseAdmin
            .from('email_preferences')
            .update({ email_frequency: 'realtime' })
            .eq('email', seed.ownerEmail);

        await enforceTierLimitsOnChange('starter', mockCustomerId);

        const { data: pref } = await supabaseAdmin
            .from('email_preferences')
            .select('email_frequency')
            .eq('email', seed.ownerEmail)
            .single();
        expect(pref?.email_frequency).toBe('digest');
    });

    test('downgrade to null (cancelled) also enforces Starter-equivalent caps', async () => {
        // `customer.subscription.deleted` calls enforceTierLimitsOnChange(null, ...)
        // which should behave like the Starter limits (no public dashboard, no realtime).
        const seed = getSeedResult();

        // Re-enable sharing + realtime so we have something to disable.
        await supabaseAdmin
            .from('projects')
            .update({ is_sharing_enabled: true })
            .eq('workspace_id', seed.workspaceId);
        await supabaseAdmin
            .from('email_preferences')
            .update({ email_frequency: 'realtime' })
            .eq('email', seed.ownerEmail);

        await enforceTierLimitsOnChange(null, mockCustomerId);

        const { data: projects } = await supabaseAdmin
            .from('projects')
            .select('is_sharing_enabled')
            .eq('workspace_id', seed.workspaceId);
        for (const p of projects ?? []) {
            expect(p.is_sharing_enabled).toBe(false);
        }

        const { data: pref } = await supabaseAdmin
            .from('email_preferences')
            .select('email_frequency')
            .eq('email', seed.ownerEmail)
            .single();
        expect(pref?.email_frequency).toBe('digest');
    });
});
