/**
 * Main Responsibility: Exercises the role × billing-state access matrix.
 * Targets the three centralised gates: `hasActiveAccess()` (tier-config.ts),
 * the proxy paywall (supabase/proxy.ts), and `isWorkspaceOwner()` (role-helpers.ts).
 *
 * Matrix:
 *   Roles:          owner, member, client
 *   Billing states: trial-active, trial-expired, subscribed-starter, subscribed-pro
 *
 * Sensitive Dependencies:
 * - `setOwnerBillingState()` mutates the owner profile. Runs serially and
 *   restores the original state in `afterAll` so other tests aren't affected.
 * - Members and clients inherit the owner's gate — they don't own subscriptions.
 */

import { test, expect, type APIRequestContext } from '@playwright/test';
import { supabaseAdmin } from './utils/supabase-admin';
import { getSeedResult } from './utils/seed-result';
import { AUTH_FILES } from './fixtures/test-data';

// Must run serially — mutates shared owner profile
test.describe.configure({ mode: 'serial' });

// ---------------------------------------------------------------------------
// Billing state helper
// ---------------------------------------------------------------------------

type BillingState =
    | 'trial-active'
    | 'trial-expired'
    | 'subscribed-starter'
    | 'subscribed-pro';

const fourteenDaysFromNow = () =>
    new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
const yesterday = () =>
    new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

async function setOwnerBillingState(ownerId: string, state: BillingState) {
    const updates: Record<BillingState, {
        subscription_status: string | null;
        subscription_tier: string | null;
        trial_ends_at: string | null;
    }> = {
        'trial-active': {
            subscription_status: null,
            subscription_tier: null,
            trial_ends_at: fourteenDaysFromNow(),
        },
        'trial-expired': {
            subscription_status: null,
            subscription_tier: null,
            trial_ends_at: yesterday(),
        },
        'subscribed-starter': {
            subscription_status: 'active',
            subscription_tier: 'starter',
            trial_ends_at: yesterday(),
        },
        'subscribed-pro': {
            subscription_status: 'active',
            subscription_tier: 'pro',
            trial_ends_at: yesterday(),
        },
    };

    const { error } = await supabaseAdmin
        .from('profiles')
        .update(updates[state])
        .eq('id', ownerId);
    if (error) throw new Error(`setOwnerBillingState failed: ${error.message}`);
}

// `hasActiveAccess` = subscribed OR trial-active. Every other state locks widget.
function expectedWidgetAllowed(state: BillingState): boolean {
    return state !== 'trial-expired';
}

// ---------------------------------------------------------------------------
// Widget gate — the single most important boundary (drives revenue).
// ---------------------------------------------------------------------------

test.describe('Widget gate × owner billing state', () => {
    let originalTrialEndsAt: string | null = null;
    let originalStatus: string | null = null;
    let originalTier: string | null = null;

    test.beforeAll(async () => {
        const seed = getSeedResult();
        const { data } = await supabaseAdmin
            .from('profiles')
            .select('trial_ends_at, subscription_status, subscription_tier')
            .eq('id', seed.ownerId)
            .single();
        originalTrialEndsAt = data?.trial_ends_at ?? null;
        originalStatus = data?.subscription_status ?? null;
        originalTier = data?.subscription_tier ?? null;
    });

    test.afterAll(async () => {
        const seed = getSeedResult();
        await supabaseAdmin
            .from('profiles')
            .update({
                trial_ends_at: originalTrialEndsAt,
                subscription_status: originalStatus,
                subscription_tier: originalTier,
            })
            .eq('id', seed.ownerId);
    });

    const states: BillingState[] = [
        'trial-active',
        'trial-expired',
        'subscribed-starter',
        'subscribed-pro',
    ];

    for (const state of states) {
        test(`widget config — ${state}`, async ({ request }) => {
            const seed = getSeedResult();
            await setOwnerBillingState(seed.ownerId, state);

            const response = await request.get(`/api/widget?key=${seed.apiKey}`);

            if (expectedWidgetAllowed(state)) {
                expect(response.status(), `${state} should allow widget`).toBe(200);
                const body = await response.json();
                expect(body.project?.name).toBeTruthy();
            } else {
                expect(response.status(), `${state} should block widget`).toBe(403);
                const body = await response.json();
                expect(body.error).toContain('inactive');
            }
        });
    }

    test('widget config — invalid API key (sanity)', async ({ request }) => {
        const response = await request.get('/api/widget?key=not-a-real-key');
        expect(response.status()).toBe(401);
    });
});

// ---------------------------------------------------------------------------
// Dashboard paywall — triggers only when the SELECTED workspace is one the
// user owns AND their trial/sub is inactive. Members accessing an invited
// workspace should never be paywalled regardless of the owner's status.
// ---------------------------------------------------------------------------

test.describe('Dashboard paywall × role', () => {
    let originalTrialEndsAt: string | null = null;
    let originalStatus: string | null = null;
    let originalTier: string | null = null;

    test.beforeAll(async () => {
        const seed = getSeedResult();
        const { data } = await supabaseAdmin
            .from('profiles')
            .select('trial_ends_at, subscription_status, subscription_tier')
            .eq('id', seed.ownerId)
            .single();
        originalTrialEndsAt = data?.trial_ends_at ?? null;
        originalStatus = data?.subscription_status ?? null;
        originalTier = data?.subscription_tier ?? null;
    });

    test.afterAll(async () => {
        const seed = getSeedResult();
        await supabaseAdmin
            .from('profiles')
            .update({
                trial_ends_at: originalTrialEndsAt,
                subscription_status: originalStatus,
                subscription_tier: originalTier,
            })
            .eq('id', seed.ownerId);
    });

    test.describe('owner', () => {
        test.use({ storageState: AUTH_FILES.owner });

        test('trial-active → dashboard accessible', async ({ page }) => {
            const seed = getSeedResult();
            await setOwnerBillingState(seed.ownerId, 'trial-active');

            await page.goto('/dashboard');
            await page.waitForLoadState('networkidle');
            expect(page.url()).toContain('/dashboard');
            expect(page.url()).not.toContain('/subscribe');
        });

        test('trial-expired → redirected to /dashboard/subscribe', async ({ page }) => {
            const seed = getSeedResult();
            await setOwnerBillingState(seed.ownerId, 'trial-expired');

            await page.goto('/dashboard');
            await page.waitForURL(/\/dashboard\/subscribe/, { timeout: 10_000 });
            expect(page.url()).toContain('/dashboard/subscribe');
        });

        test('subscribed-starter → dashboard accessible', async ({ page }) => {
            const seed = getSeedResult();
            await setOwnerBillingState(seed.ownerId, 'subscribed-starter');

            await page.goto('/dashboard');
            await page.waitForLoadState('networkidle');
            expect(page.url()).toContain('/dashboard');
            expect(page.url()).not.toContain('/subscribe');
        });
    });

    test.describe('member (of owner)', () => {
        test.use({ storageState: AUTH_FILES.member });

        test('owner trial-expired → member still reaches dashboard (invited workspace)', async ({ page, context }) => {
            const seed = getSeedResult();
            await setOwnerBillingState(seed.ownerId, 'trial-expired');

            // Point the member at the owner's (expired) workspace so the proxy
            // has to decide whether to paywall. Members should NOT be paywalled
            // when viewing an invited workspace — the owner's trial is the
            // owner's problem, not theirs.
            await context.addCookies([{
                name: 'selectedWorkspaceId',
                value: seed.workspaceId,
                url: 'http://127.0.0.1:3000',
            }]);

            await page.goto('/dashboard');
            await page.waitForLoadState('networkidle');
            expect(page.url()).toContain('/dashboard');
            expect(page.url()).not.toContain('/subscribe');
        });

        test('owner subscribed → member reaches dashboard normally', async ({ page, context }) => {
            const seed = getSeedResult();
            await setOwnerBillingState(seed.ownerId, 'subscribed-pro');

            await context.addCookies([{
                name: 'selectedWorkspaceId',
                value: seed.workspaceId,
                url: 'http://127.0.0.1:3000',
            }]);

            await page.goto('/dashboard');
            await page.waitForLoadState('networkidle');
            expect(page.url()).toContain('/dashboard');
            expect(page.url()).not.toContain('/subscribe');
        });
    });
});

// ---------------------------------------------------------------------------
// Role-gated endpoints — only owners can create workspace invites.
// ---------------------------------------------------------------------------

test.describe('Invite endpoint × role', () => {
    // Keep the owner in a healthy subscribed state so the paywall never
    // becomes the reason a request fails — we're testing role, not billing.
    test.beforeAll(async () => {
        const seed = getSeedResult();
        await setOwnerBillingState(seed.ownerId, 'subscribed-pro');
    });

    async function postInvite(request: APIRequestContext, workspaceId: string, email: string) {
        return request.post('/api/workspaces/invites', {
            data: { workspaceId, email, role: 'client' },
        });
    }

    test('owner can create an invite', async ({ browser }) => {
        const seed = getSeedResult();
        const ctx = await browser.newContext({ storageState: AUTH_FILES.owner });
        const response = await postInvite(
            ctx.request,
            seed.workspaceId,
            `e2e-invite-owner-${Date.now()}@example.com`,
        );
        // Accept any 2xx — the invite flow may return 200/201/204
        expect(response.status(), `got ${response.status()}`).toBeLessThan(300);
        await ctx.close();
    });

    test('member cannot create an invite (403)', async ({ browser }) => {
        const seed = getSeedResult();
        const ctx = await browser.newContext({ storageState: AUTH_FILES.member });
        const response = await postInvite(
            ctx.request,
            seed.workspaceId,
            `e2e-invite-member-${Date.now()}@example.com`,
        );
        expect(response.status()).toBe(403);
        await ctx.close();
    });

    test('client cannot create an invite (403)', async ({ browser }) => {
        const seed = getSeedResult();
        const ctx = await browser.newContext({ storageState: AUTH_FILES.client });
        const response = await postInvite(
            ctx.request,
            seed.workspaceId,
            `e2e-invite-client-${Date.now()}@example.com`,
        );
        expect(response.status()).toBe(403);
        await ctx.close();
    });
});
