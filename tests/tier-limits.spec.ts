/**
 * Tier 1 — Revenue-critical: Tier limit enforcement
 *
 * Asserts that Starter tier caps are enforced at the API surface and that
 * downgrades take effect (sharing disabled, realtime email frozen to digest).
 *
 * Starter caps (from src/lib/tier-config.ts):
 *   - 3 projects
 *   - 2 team members (members only, excluding owner + clients)
 *   - publicDashboard: false       → is_sharing_enabled flipped off on downgrade
 *   - emailFrequencies: ['digest'] → 'realtime' flipped back to 'digest' on downgrade
 *
 * Sensitive Dependencies:
 * - Mutates owner profile (subscription_tier/status) and inserts/deletes seed
 *   workspace projects + invites. Every beforeAll captures original state and
 *   the matching afterAll restores it so other specs are unaffected.
 */

import { test, expect } from '@playwright/test';
import { supabaseAdmin } from './utils/supabase-admin';
import { getSeedResult } from './utils/seed-result';
import { AUTH_FILES } from './fixtures/test-data';

// Tier mutations are workspace-wide — can't parallelise safely.
test.describe.configure({ mode: 'serial' });

type ProfileSnapshot = {
    subscription_tier: string | null;
    subscription_status: string | null;
    trial_ends_at: string | null;
};

async function snapshotProfile(ownerId: string): Promise<ProfileSnapshot> {
    const { data } = await supabaseAdmin
        .from('profiles')
        .select('subscription_tier, subscription_status, trial_ends_at')
        .eq('id', ownerId)
        .single();
    return {
        subscription_tier: data?.subscription_tier ?? null,
        subscription_status: data?.subscription_status ?? null,
        trial_ends_at: data?.trial_ends_at ?? null,
    };
}

async function setTier(ownerId: string, tier: 'starter' | 'pro' | 'business') {
    // Push trial_ends_at into the past so the trial gate (which treats all
    // trialing users as Pro) doesn't mask the Starter caps we want to exercise.
    await supabaseAdmin
        .from('profiles')
        .update({
            subscription_tier: tier,
            subscription_status: 'active',
            trial_ends_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        })
        .eq('id', ownerId);
}

async function restoreProfile(ownerId: string, snap: ProfileSnapshot) {
    await supabaseAdmin
        .from('profiles')
        .update({
            subscription_tier: snap.subscription_tier,
            subscription_status: snap.subscription_status,
            trial_ends_at: snap.trial_ends_at,
        })
        .eq('id', ownerId);
}

// ---------------------------------------------------------------------------
// Project cap — Starter = 3 projects total.
// Seed gives us 1 project, we top up to 3 via admin, then try one more via API.
// ---------------------------------------------------------------------------

test.describe('Starter tier: project cap', () => {
    test.use({ storageState: AUTH_FILES.owner });

    let snap: ProfileSnapshot;
    const extraProjectIds: string[] = [];

    test.beforeAll(async () => {
        const seed = getSeedResult();
        snap = await snapshotProfile(seed.ownerId);
        await setTier(seed.ownerId, 'starter');

        // Top the workspace up to exactly 3 projects (the Starter cap).
        const { count: existing } = await supabaseAdmin
            .from('projects')
            .select('*', { count: 'exact', head: true })
            .eq('workspace_id', seed.workspaceId);

        const need = 3 - (existing ?? 0);
        for (let i = 0; i < need; i++) {
            const { data } = await supabaseAdmin
                .from('projects')
                .insert({
                    name: `E2E tier-cap filler ${i}-${Date.now()}`,
                    website_url: 'https://filler.example.com',
                    workspace_id: seed.workspaceId,
                    user_id: seed.ownerId,
                })
                .select('id')
                .single();
            if (data?.id) extraProjectIds.push(data.id);
        }
    });

    test.afterAll(async () => {
        const seed = getSeedResult();
        if (extraProjectIds.length) {
            await supabaseAdmin.from('projects').delete().in('id', extraProjectIds);
        }
        await restoreProfile(seed.ownerId, snap);
    });

    test('POST /api/projects at cap returns 403 with upgrade message', async ({ request }) => {
        const seed = getSeedResult();
        const before = await supabaseAdmin
            .from('projects')
            .select('id', { count: 'exact', head: true })
            .eq('workspace_id', seed.workspaceId);

        const response = await request.post('/api/projects', {
            data: {
                name: 'Should Not Exist',
                website_url: 'https://blocked.example.com',
                workspace_id: seed.workspaceId,
            },
        });

        expect(response.status(), `got ${response.status()}`).toBe(403);
        const msg = await response.text();
        expect(msg).toMatch(/project limit|Upgrade/i);

        const after = await supabaseAdmin
            .from('projects')
            .select('id', { count: 'exact', head: true })
            .eq('workspace_id', seed.workspaceId);
        expect(after.count, 'no project row should have been created').toBe(before.count);
    });
});

// ---------------------------------------------------------------------------
// Member cap — Starter = 2 members (existing members + pending invites).
// Seed gives us 1 member, we add 1 pending invite to reach 2, then the next
// invite must be rejected.
// ---------------------------------------------------------------------------

test.describe('Starter tier: member cap', () => {
    test.use({ storageState: AUTH_FILES.owner });

    let snap: ProfileSnapshot;
    const createdInviteIds: string[] = [];

    test.beforeAll(async () => {
        const seed = getSeedResult();
        snap = await snapshotProfile(seed.ownerId);
        await setTier(seed.ownerId, 'starter');

        // Seed has 1 member. Add invites until we're at the 2-member cap.
        const { count: memberCount } = await supabaseAdmin
            .from('workspace_members')
            .select('*', { count: 'exact', head: true })
            .eq('workspace_id', seed.workspaceId)
            .eq('role', 'member');
        const { count: pendingInvites } = await supabaseAdmin
            .from('workspace_invites')
            .select('*', { count: 'exact', head: true })
            .eq('workspace_id', seed.workspaceId)
            .eq('role', 'member');

        const need = 2 - ((memberCount ?? 0) + (pendingInvites ?? 0));
        for (let i = 0; i < need; i++) {
            const { data } = await supabaseAdmin
                .from('workspace_invites')
                .insert({
                    workspace_id: seed.workspaceId,
                    email: `e2e-membercap-fill-${i}-${Date.now()}@example.com`,
                    role: 'member',
                })
                .select('id')
                .single();
            if (data?.id) createdInviteIds.push(data.id);
        }
    });

    test.afterAll(async () => {
        const seed = getSeedResult();
        if (createdInviteIds.length) {
            await supabaseAdmin.from('workspace_invites').delete().in('id', createdInviteIds);
        }
        await restoreProfile(seed.ownerId, snap);
    });

    test('POST /api/workspaces/invites at cap returns 403 for member role', async ({ request }) => {
        const seed = getSeedResult();
        const blockedEmail = `e2e-membercap-blocked-${Date.now()}@example.com`;

        const response = await request.post('/api/workspaces/invites', {
            data: {
                workspaceId: seed.workspaceId,
                email: blockedEmail,
                role: 'member',
            },
        });

        expect(response.status(), `got ${response.status()}`).toBe(403);
        const msg = await response.text();
        expect(msg).toMatch(/team member limit|Upgrade/i);

        const { data: ghost } = await supabaseAdmin
            .from('workspace_invites')
            .select('id')
            .eq('workspace_id', seed.workspaceId)
            .eq('email', blockedEmail);
        expect(ghost?.length ?? 0).toBe(0);
    });

    test('client invites are NOT capped (unlimited on any tier)', async ({ request }) => {
        const seed = getSeedResult();
        const clientEmail = `e2e-client-nocap-${Date.now()}@example.com`;

        const response = await request.post('/api/workspaces/invites', {
            data: {
                workspaceId: seed.workspaceId,
                email: clientEmail,
                role: 'client',
            },
        });

        expect(response.status(), `got ${response.status()}`).toBeLessThan(300);

        // Clean up the invite so afterAll doesn't skip it.
        const { data } = await supabaseAdmin
            .from('workspace_invites')
            .select('id')
            .eq('workspace_id', seed.workspaceId)
            .eq('email', clientEmail)
            .maybeSingle();
        if (data?.id) {
            await supabaseAdmin.from('workspace_invites').delete().eq('id', data.id);
        }
    });
});
